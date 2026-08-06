import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Clock3,
  CopyPlus,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  Search,
  Send,
  Sparkles,
  Ticket,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AppUserProfile,
  type AppUserRole,
  type AppUserStatus,
  type ChekiRecruitmentRecord,
  createLineAccountLink,
  deleteUserProfile,
  ensureCurrentUserProfile,
  loadUserProfiles,
  loadWorkspaceData,
  saveChekiApplications,
  saveWorkspaceData,
  sendLineTestNotification,
  updateUserProfile,
} from "./appDatabase";
import { isSupabaseConfigured, supabase, type Session } from "./supabaseClient";

type LiveStatus = "計画" | "進行中" | "完了" | "キャンセル";
type TaskStatus = "未着手" | "進行中" | "完了";
type Priority = "必須" | "重要" | "通常";
type Phase = "イベント" | "チケット" | "企画" | "制作物" | "衣装" | "当日";
type LiveType = "ワンマン" | "定期公演" | "生誕祭";
type TaskView = "未着手" | "進行中" | "完了済み";
type LiveListView = "未" | "完";
type AppMode = "work" | "manager" | "cheki";
type TaskRoleFilter = "全ロール" | "マネージャー" | "デザイナー" | "制作・外注" | "チケット" | "当日運営";
type TicketStatus = "未作成" | "作成中" | "確認中" | "公開済";
type ProductionStatus = "未依頼" | "依頼済" | "制作中" | "確認待ち" | "入稿済" | "納品済";
type RunScheduleDay = "前日" | "当日";
type RunScheduleOwnerKind = "FOCスタッフ" | "チェキスタッフ" | "出演者" | "会場スタッフ" | "その他";
type LegacyRunScheduleOwnerKind = "御社スタッフ" | "会場";
type RunScheduleOwnerFilter = "全て" | RunScheduleOwnerKind;
type ManagerFilter = "全て" | "遅延" | "今日" | "3日以内" | "外注" | "確認待ち" | "未依頼";
type ManagerIssueKind = "遅延" | "今日" | "3日以内" | "外注" | "確認待ち" | "未入力" | "未依頼";
type ManagerRisk = "high" | "warn" | "ok";
type ManagerContact = { owner: string; count: number; reason: string; score: number };
type GroupPage = {
  id?: string;
  name: string;
  manager: string;
  photo: string;
  calendarUrl?: string;
};

type SubTask = {
  id: string;
  title: string;
  done: boolean;
};

type Task = {
  id: string;
  phase: Phase;
  title: string;
  dueDate: string;
  owner: string;
  priority: Priority;
  status: TaskStatus;
  memo?: string;
  subtasks?: SubTask[];
};

type TaskTemplateItem = {
  id: string;
  phase: Phase;
  title: string;
  offset: number;
  owner: string;
  priority: Priority;
  memo?: string;
  subtasks: string[];
};

type TaskTemplateSet = {
  id: string;
  name: string;
  liveType: LiveType | "共通";
  items: TaskTemplateItem[];
};

type TicketPlan = {
  id: string;
  name: string;
  price: number;
  saleStart: string;
  benefit: string;
  pageUrl?: string;
  status?: TicketStatus;
};

type ProductionItem = {
  id: string;
  name: string;
  owner: string;
  designer?: string;
  vendor: string;
  dueDate: string;
  status: ProductionStatus;
  fileUrl?: string;
  memo?: string;
};

type RunScheduleItem = {
  id: string;
  day: RunScheduleDay;
  time: string;
  title: string;
  ownerKind?: RunScheduleOwnerKind | LegacyRunScheduleOwnerKind;
  owner: string;
  place: string;
  note?: string;
};

type RunScheduleTemplateItem = Omit<RunScheduleItem, "id">;

type RunScheduleTemplateSet = {
  id: string;
  name: string;
  liveType: LiveType | "共通";
  items: RunScheduleTemplateItem[];
};

type LiveProject = {
  id: string;
  group: string;
  title: string;
  venue: string;
  eventDate: string;
  status: LiveStatus;
  manager: string;
  liveType: LiveType;
  ticketLaunch: string;
  rehearsal: string;
  photoShoot: string;
  productionCompany: string;
  driveFolderUrl?: string;
  sourceCalendarEventId?: string;
  tasks: Task[];
  tickets: TicketPlan[];
  productionItems: ProductionItem[];
  scheduleItems?: RunScheduleItem[];
};

type NewLiveForm = {
  group: string;
  title: string;
  venue: string;
  eventDate: string;
  manager: string;
  liveType: LiveType;
};

type GroupForm = {
  name: string;
  manager: string;
  photo: string;
  calendarUrl: string;
};

type CalendarItem = {
  id: string;
  date: string;
  time: string;
  title: string;
  liveTitle: string;
  kind: string;
  liveId?: string;
  taskId?: string;
  taskStatus?: TaskStatus;
  readonly?: boolean;
  sourceUrl?: string;
};

type GeneratedCalendarPayload = {
  calendars?: Array<{
    group: string;
    events?: Array<{
      id: string;
      date: string;
      time: string;
      title: string;
      location?: string;
      sourceUrl?: string;
    }>;
  }>;
  holidays?: Array<{
    id: string;
    date: string;
    time: string;
    title: string;
    location?: string;
    sourceUrl?: string;
  }>;
};

type DragTask = {
  liveId: string;
  taskId: string;
  title: string;
};

type ManagerIssue = {
  id: string;
  kind: ManagerIssueKind;
  tags: ManagerFilter[];
  group: string;
  liveId: string;
  liveTitle: string;
  owner: string;
  title: string;
  detail: string;
  date?: string;
  taskId?: string;
  ticketId?: string;
  productionItemId?: string;
  priority: number;
};

type ChekiShift = {
  id: string;
  liveId: string;
  group: string;
  liveTitle: string;
  venue: string;
  date: string;
  timeRange: string;
  role: string;
  requiredCount: number;
  assignedCount: number;
  status: "募集中" | "応募済み" | "確定";
  cancelUntil: string;
  meetingTime: string;
  meetingPlace: string;
  belongings: string;
  memo: string;
};
type ChekiCalendarDateStatus = "available" | "full";

const initialGroupPages: GroupPage[] = [
  {
    id: "group-heymommy",
    name: "Hey!Mommy!",
    manager: "小杉",
    photo: "",
    calendarUrl:
      "https://calendar.google.com/calendar/u/0/newembed?height=600&wkst=1&bgcolor=%23f772cf&ctz=Asia/Tokyo&title=Hey!Mommy!&src=aGV5bW9tbXkxMTExMUBnbWFpbC5jb20&src=amEuamFwYW5lc2UjaG9saWRheUBncm91cC52LmNhbGVuZGFyLmdvb2dsZS5jb20&color=%23D81B60&color=%23F09300",
  },
  {
    id: "group-scramble-smile",
    name: "SCRAMBLE SMILE",
    manager: "御手洗",
    photo: "",
    calendarUrl: "https://calendar.google.com/calendar/u/0/newembed?src=info@scramblesmile.jp&ctz=Asia/Tokyo",
  },
];

const managers = ["小杉", "御手洗", "鍋島"];
const taskRoleFilters: TaskRoleFilter[] = [
  "全ロール",
  "マネージャー",
  "デザイナー",
  "制作・外注",
  "チケット",
  "当日運営",
];
const phaseOrder: Phase[] = ["イベント", "チケット", "企画", "制作物", "衣装", "当日"];
const ticketStatuses: TicketStatus[] = ["未作成", "作成中", "確認中", "公開済"];
const productionStatuses: ProductionStatus[] = ["未依頼", "依頼済", "制作中", "確認待ち", "入稿済", "納品済"];
const runScheduleOwnerKinds: RunScheduleOwnerKind[] = [
  "FOCスタッフ",
  "チェキスタッフ",
  "出演者",
  "会場スタッフ",
  "その他",
];
const fiveMinuteTimes = Array.from({ length: 24 * 12 }, (_, index) => {
  const hour = `${Math.floor(index / 12)}`.padStart(2, "0");
  const minute = `${(index % 12) * 5}`.padStart(2, "0");
  return `${hour}:${minute}`;
});
const today = startOfDay(new Date());

const taskTemplates: Array<{
  phase: Phase;
  title: string;
  offset: number;
  owner: string;
  priority: Priority;
  memo?: string;
}> = [
  { phase: "イベント", title: "イベント日決定", offset: -120, owner: "小杉", priority: "必須" },
  { phase: "イベント", title: "会場決定＆予約", offset: -110, owner: "小杉", priority: "必須" },
  { phase: "イベント", title: "ライブタイトル決定", offset: -75, owner: "御手洗", priority: "重要" },
  {
    phase: "チケット",
    title: "FC・一般スケジュール決定",
    offset: -65,
    owner: "御手洗",
    priority: "必須",
  },
  { phase: "チケット", title: "チケットページ作成", offset: -55, owner: "小杉", priority: "必須" },
  { phase: "企画", title: "タイムテーブル作成", offset: -45, owner: "鍋島", priority: "重要" },
  { phase: "企画", title: "楽曲制作", offset: -60, owner: "鍋島", priority: "重要" },
  { phase: "企画", title: "セトリ", offset: -25, owner: "鍋島", priority: "重要" },
  { phase: "企画", title: "ゲネプロスタジオ予約", offset: -35, owner: "小杉", priority: "必須" },
  { phase: "企画", title: "当日バイト手配", offset: -18, owner: "小杉", priority: "重要" },
  { phase: "企画", title: "当日カメラマン手配", offset: -28, owner: "小杉", priority: "重要" },
  {
    phase: "制作物",
    title: "告知画像の依頼",
    offset: -50,
    owner: "御手洗",
    priority: "重要",
    memo: "素材一式を共有",
  },
  { phase: "制作物", title: "デザイナー制作発注", offset: -45, owner: "御手洗", priority: "重要" },
  { phase: "制作物", title: "制作物リストの企画", offset: -40, owner: "御手洗", priority: "重要" },
  { phase: "制作物", title: "グッズ入稿", offset: -21, owner: "御手洗", priority: "必須" },
  {
    phase: "衣装",
    title: "衣装イメージ共有",
    offset: -55,
    owner: "御手洗",
    priority: "重要",
    memo: "制作会社へ方向性共有",
  },
  { phase: "衣装", title: "最終確認", offset: -16, owner: "御手洗", priority: "必須" },
  { phase: "衣装", title: "衣装納品", offset: -10, owner: "御手洗", priority: "必須" },
  { phase: "衣装", title: "アー写＆ブロマイド撮影", offset: -30, owner: "鍋島", priority: "重要" },
  { phase: "当日", title: "VIP用ピクチャチケットを準備", offset: -7, owner: "小杉", priority: "通常" },
  {
    phase: "当日",
    title: "ビデオカメラのバッテリー充電＆確認",
    offset: -2,
    owner: "小杉",
    priority: "通常",
  },
  { phase: "当日", title: "最前列の紙用意", offset: -2, owner: "小杉", priority: "通常" },
];

const subtaskTemplates: Record<string, string[]> = {
  "チケットページ作成": [
    "券種・価格を確定",
    "特典内容を確認",
    "販売ページを作成",
    "URLを共有",
    "公開確認",
  ],
  "タイムテーブル作成": [
    "入り時間を確認",
    "本番尺を確定",
    "転換時間を入れる",
    "関係者へ共有",
  ],
  "楽曲制作": [
    "制作範囲を確定",
    "デモ確認",
    "修正依頼",
    "音源納品確認",
  ],
  "セトリ": [
    "候補曲を整理",
    "曲順を決定",
    "音源・歌詞を確認",
    "メンバーへ共有",
  ],
  "告知画像の依頼": [
    "必要素材を集める",
    "掲載情報を確定",
    "外注先へ依頼",
    "初稿確認",
    "公開用データ確認",
  ],
  "制作物リストの企画": [
    "制作物候補を出す",
    "数量を仮決め",
    "原価を確認",
    "発注対象を確定",
  ],
  "グッズ入稿": [
    "商品名を確定",
    "価格を確定",
    "デザインデータ確認",
    "入稿先へ送付",
    "入稿完了確認",
  ],
  "衣装イメージ共有": [
    "参考画像を集める",
    "カラー・方向性を決める",
    "制作会社へ共有",
    "初回フィードバック確認",
  ],
  "最終確認": [
    "サイズ確認",
    "着用写真確認",
    "修正点を整理",
    "最終OKを出す",
  ],
  "衣装納品": [
    "納品日を確認",
    "不足物を確認",
    "保管場所を決める",
    "当日持ち出し準備",
  ],
  "VIP用ピクチャチケットを準備": [
    "対象者数を確認",
    "デザイン確認",
    "印刷",
    "当日受付へ共有",
  ],
};

function createDefaultTaskTemplateSet(): TaskTemplateSet {
  return {
    id: "template-standard",
    name: "標準ライブ",
    liveType: "共通",
    items: taskTemplates.map((template, index) => ({
      id: `template-standard-item-${index}`,
      phase: template.phase,
      title: template.title,
      offset: template.offset,
      owner: template.owner,
      priority: template.priority,
      memo: template.memo,
      subtasks: subtaskTemplates[template.title] ?? [],
    })),
  };
}

function cloneTaskTemplateSet(template: TaskTemplateSet): TaskTemplateSet {
  return {
    ...template,
    items: template.items.map((item) => ({
      ...item,
      subtasks: [...item.subtasks],
    })),
  };
}

function createBlankTaskTemplateSet(owner = managers[0]): TaskTemplateSet {
  return {
    id: `template-${crypto.randomUUID()}`,
    name: "",
    liveType: "共通",
    items: [
      {
        id: `template-item-${crypto.randomUUID()}`,
        phase: "イベント",
        title: "",
        offset: -30,
        owner,
        priority: "通常",
        subtasks: [],
      },
    ],
  };
}

function createDefaultRunScheduleTemplateSet(): RunScheduleTemplateSet {
  return {
    id: "run-template-standard",
    name: "標準進行表",
    liveType: "共通",
    items: defaultRunSchedule("run-template-standard", toIsoDate(today), "ワンマン", "小杉").map(
      ({ id: _id, ...item }) => item,
    ),
  };
}

function cloneRunScheduleTemplateSet(template: RunScheduleTemplateSet): RunScheduleTemplateSet {
  return {
    ...template,
    items: template.items.map((item) => ({ ...item })),
  };
}

function buildRunScheduleFromTemplate(projectId: string, templateItems: RunScheduleTemplateItem[]): RunScheduleItem[] {
  return sortRunSchedule(
    templateItems.map((item, index) => ({
      ...item,
      id: `${projectId}-schedule-template-${index}-${crypto.randomUUID()}`,
    })),
  );
}

const initialProjects: LiveProject[] = [];
const authEnabled = import.meta.env.VITE_AUTH_ENABLED === "true";
const noAuthUserId = "00000000-0000-0000-0000-000000000000";
const lineLinkTokenStorageKey = "idleTaskPendingLineLinkToken";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authView, setAuthView] = useState<"signin" | "signup" | "reset">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [pendingLineLinkToken, setPendingLineLinkToken] = useState(() => consumeLineLinkTokenFromUrl());
  const [lineLinkMessage, setLineLinkMessage] = useState("");
  const [lineLinkError, setLineLinkError] = useState("");
  const [isLineLinking, setIsLineLinking] = useState(false);
  const lineLinkInFlightRef = useRef(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<AppUserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [userProfiles, setUserProfiles] = useState<AppUserProfile[]>([]);
  const [userManagementMessage, setUserManagementMessage] = useState("");
  const [lineTestSendingUserId, setLineTestSendingUserId] = useState("");
  const [managerSection, setManagerSection] = useState<"status" | "users">("status");
  const [isDataReady, setIsDataReady] = useState(!isSupabaseConfigured);
  const [isLoadingData, setIsLoadingData] = useState(isSupabaseConfigured);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"未接続" | "保存中" | "保存済み" | "保存失敗">(
    isSupabaseConfigured ? "保存済み" : "未接続",
  );
  const lastSavedSnapshotRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);
  const [projects, setProjects] = useState<LiveProject[]>(initialProjects);
  const [groups, setGroups] = useState<GroupPage[]>(initialGroupPages);
  const [externalCalendarItems, setExternalCalendarItems] = useState<CalendarItem[]>([]);
  const [appMode, setAppMode] = useState<AppMode>("work");
  const [managerGroupFilter, setManagerGroupFilter] = useState("全グループ");
  const [selectedManagerLiveId, setSelectedManagerLiveId] = useState(initialProjects[0]?.id ?? "");
  const [managerContactFilter, setManagerContactFilter] = useState("全員");
  const [managerRoleFilter, setManagerRoleFilter] = useState<TaskRoleFilter>("全ロール");
  const [selectedManagerIssueId, setSelectedManagerIssueId] = useState("");
  const [activeGroup, setActiveGroup] = useState(initialGroupPages[0].name);
  const [selectedLiveId, setSelectedLiveId] = useState(initialProjects[0]?.id ?? "");
  const [taskView, setTaskView] = useState<TaskView>("未着手");
  const [liveListView, setLiveListView] = useState<LiveListView>("未");
  const [query, setQuery] = useState("");
  const [taskTemplateSets, setTaskTemplateSets] = useState<TaskTemplateSet[]>([]);
  const [selectedCreateTemplateId, setSelectedCreateTemplateId] = useState("");
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TaskTemplateSet>(() => createBlankTaskTemplateSet());
  const [runScheduleTemplateSets, setRunScheduleTemplateSets] = useState<RunScheduleTemplateSet[]>(() => [
    createDefaultRunScheduleTemplateSet(),
  ]);
  const [selectedRunScheduleTemplateId, setSelectedRunScheduleTemplateId] = useState("run-template-standard");
  const [chekiRecruitments, setChekiRecruitments] = useState<ChekiRecruitmentRecord[]>([]);
  const [appliedChekiShiftIds, setAppliedChekiShiftIds] = useState<string[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskOwner, setNewTaskOwner] = useState(selectedLiveId ? "小杉" : managers[0]);
  const [taskRoleFilter, setTaskRoleFilter] = useState<TaskRoleFilter>("全ロール");
  const [taskOwnerFilter, setTaskOwnerFilter] = useState("全員");
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);
  const [taskScrollHint, setTaskScrollHint] = useState({ top: false, bottom: false });
  const [actionScrollHint, setActionScrollHint] = useState({ top: false, bottom: false });
  const [liveListScrollHint, setLiveListScrollHint] = useState({ top: false, bottom: false });
  const taskListRef = useRef<HTMLDivElement | null>(null);
  const actionColumnRef = useRef<HTMLElement | null>(null);
  const liveListRef = useRef<HTMLDivElement | null>(null);
  const groupActionsRef = useRef<HTMLDivElement | null>(null);
  const groupEditorRef = useRef<HTMLDivElement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState(false);
  const [newLive, setNewLive] = useState<NewLiveForm>({
    group: initialGroupPages[0].name,
    title: "",
    venue: "",
    eventDate: "",
    manager: initialGroupPages[0].manager,
    liveType: "ワンマン",
  });
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>({
    name: "",
    manager: initialGroupPages[0].manager,
    photo: "",
    calendarUrl: "",
  });
  const [groupNotice, setGroupNotice] = useState("");
  const activeGroupProfile = groups.find((group) => group.name === activeGroup);
  const selectedCreateTemplate =
    taskTemplateSets.find((template) => template.id === selectedCreateTemplateId) ?? taskTemplateSets[0];
  const selectedRunScheduleTemplate =
    runScheduleTemplateSets.find((template) => template.id === selectedRunScheduleTemplateId) ??
    runScheduleTemplateSets[0];
  const userId = authEnabled ? session?.user.id : noAuthUserId;
  const isApprovedUser = !authEnabled || currentUserProfile?.status === "active";
  const userRole: AppUserRole = !authEnabled
    ? "admin"
    : currentUserProfile?.status === "active"
      ? currentUserProfile.role
      : "cheki";
  const isAdmin = userRole === "admin";
  const isEmployee = userRole === "admin" || userRole === "employee";
  const effectiveAppMode: AppMode = isEmployee ? appMode : "cheki";
  const needsPasswordSetup =
    authEnabled && Boolean(session) && (recoveryMode || session?.user.user_metadata?.password_set !== true);
  const authRedirectUrl = getAuthRedirectUrl();

  useEffect(() => {
    if (taskTemplateSets.length === 0) {
      if (selectedCreateTemplateId) setSelectedCreateTemplateId("");
      return;
    }
    if (!taskTemplateSets.some((template) => template.id === selectedCreateTemplateId)) {
      setSelectedCreateTemplateId(taskTemplateSets[0].id);
    }
  }, [selectedCreateTemplateId, taskTemplateSets]);

  useEffect(() => {
    if (!supabase || !authEnabled) return;

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setSession(nextSession);
      if (!nextSession) {
        setCurrentUserProfile(null);
        setIsProfileLoading(false);
        setUserProfiles([]);
        setUserManagementMessage("");
        setManagerSection("status");
        setProjects([]);
        setChekiRecruitments([]);
        setAppliedChekiShiftIds([]);
        setIsDataReady(false);
        setIsLoadingData(false);
        lastSavedSnapshotRef.current = "";
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !authEnabled || !session || needsPasswordSetup) return;

    let cancelled = false;
    setIsProfileLoading(true);
    setLoadError("");

    ensureCurrentUserProfile(session.user.id, session.user.email ?? "")
      .then((profile) => {
        if (cancelled) return;
        setCurrentUserProfile(profile);
        setIsProfileLoading(false);
        if (profile.status !== "active") {
          setIsDataReady(false);
          setIsLoadingData(false);
          setProjects([]);
          setChekiRecruitments([]);
          setAppliedChekiShiftIds([]);
        }
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setCurrentUserProfile(null);
        setIsProfileLoading(false);
        setIsDataReady(false);
        setLoadError(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [needsPasswordSetup, session]);

  useEffect(() => {
    if (!pendingLineLinkToken) return;
    if (!authEnabled) {
      setLineLinkMessage("LINE連携にはログインが必要です。認証を有効にしてください。");
      return;
    }
    if (!session || needsPasswordSetup) {
      setLineLinkMessage("LINE連携を続けるにはアプリにログインしてください。");
      return;
    }
    if (lineLinkInFlightRef.current) return;
    if (isProfileLoading || !currentUserProfile) {
      setLineLinkMessage("LINE連携のためにユーザー情報を確認しています。");
      return;
    }

    let cancelled = false;
    lineLinkInFlightRef.current = true;
    setIsLineLinking(true);
    setLineLinkMessage("LINE連携を準備しています。");
    setLineLinkError("");

    createLineAccountLink(pendingLineLinkToken)
      .then((accountLinkUrl) => {
        if (cancelled) return;
        clearPendingLineLinkToken();
        window.location.assign(accountLinkUrl);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        clearPendingLineLinkToken();
        setPendingLineLinkToken("");
        lineLinkInFlightRef.current = false;
        setIsLineLinking(false);
        setLineLinkError(
          `LINE連携URLを作成できませんでした。LINEで「連携」と送信して、もう一度やり直してください。${error.message ? ` (${error.message})` : ""}`,
        );
        setLineLinkMessage("");
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserProfile, isProfileLoading, needsPasswordSetup, pendingLineLinkToken, session]);

  useEffect(() => {
    if (!supabase || !userId || needsPasswordSetup || !isApprovedUser) return;

    let cancelled = false;
    setIsLoadingData(true);
    setLoadError("");

    loadWorkspaceData(userId, userRole)
      .then((data) => {
        if (cancelled) return;

        const nextGroups = data.groups.length > 0 ? data.groups : initialGroupPages;
        const nextTaskTemplates = data.taskTemplateSets;
        const nextRunTemplates =
          data.runScheduleTemplateSets.length > 0
            ? data.runScheduleTemplateSets
            : [createDefaultRunScheduleTemplateSet()];
        const nextProjects = data.projects.map((project) =>
          clearGeneratedDefaultScheduleInfo(restoreCalendarLiveStatus(removeGeneratedTemplateTasks(project as LiveProject))),
        );
        const removedGeneratedTasks = data.projects.some(
          (project, index) => project.tasks.length !== nextProjects[index].tasks.length,
        );
        const removedGeneratedScheduleInfo = data.projects.some((project, index) => {
          const nextProject = nextProjects[index];
          return (
            project.ticketLaunch !== nextProject.ticketLaunch ||
            project.rehearsal !== nextProject.rehearsal ||
            project.photoShoot !== nextProject.photoShoot
          );
        });
        const nextActiveGroup = nextGroups[0]?.name ?? initialGroupPages[0].name;
        const nextProject =
          nextProjects
            .filter((project) => project.group === nextActiveGroup && project.status !== "完了")
            .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0] ??
          nextProjects
            .filter((project) => project.group === nextActiveGroup)
            .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0] ??
          nextProjects[0];

        setGroups(nextGroups as GroupPage[]);
        setProjects(nextProjects);
        setTaskTemplateSets(nextTaskTemplates as TaskTemplateSet[]);
        setSelectedCreateTemplateId(nextTaskTemplates[0]?.id ?? "");
        setRunScheduleTemplateSets(nextRunTemplates as RunScheduleTemplateSet[]);
        setSelectedRunScheduleTemplateId(nextRunTemplates[0]?.id ?? "run-template-standard");
        setChekiRecruitments(data.chekiRecruitments);
        setAppliedChekiShiftIds(data.appliedChekiShiftIds);
        setActiveGroup(nextActiveGroup);
        setSelectedLiveId(nextProject?.id ?? "");
        setSelectedManagerLiveId(nextProject?.id ?? "");
        setNewLive((form) => ({
          ...form,
          group: nextActiveGroup,
          manager: nextGroups[0]?.manager ?? form.manager,
        }));
        setIsDataReady(true);
        setIsLoadingData(false);
        setSaveStatus("保存済み");
        const shouldSeedDatabase =
          data.groups.length === 0 ||
          data.runScheduleTemplateSets.length === 0 ||
          removedGeneratedTasks ||
          removedGeneratedScheduleInfo;
        lastSavedSnapshotRef.current = shouldSeedDatabase ? "" : JSON.stringify({
          groups: nextGroups,
          projects: nextProjects,
          taskTemplateSets: nextTaskTemplates,
          runScheduleTemplateSets: nextRunTemplates,
          chekiRecruitments: data.chekiRecruitments,
          appliedChekiShiftIds: data.appliedChekiShiftIds,
        });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setLoadError(error.message);
        setIsLoadingData(false);
        setIsDataReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isApprovedUser, needsPasswordSetup, userId, userRole]);

  useEffect(() => {
    if (!supabase || !userId || !isDataReady || isLoadingData || needsPasswordSetup || !isApprovedUser) return;

    const snapshot = JSON.stringify({
      groups,
      projects,
      taskTemplateSets,
      runScheduleTemplateSets,
      chekiRecruitments,
      appliedChekiShiftIds,
    });
    if (lastSavedSnapshotRef.current === snapshot) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    setSaveStatus("保存中");
    saveTimerRef.current = window.setTimeout(() => {
      const savePromise = isEmployee
        ? saveWorkspaceData(
            {
              groups,
              projects,
              taskTemplateSets,
              runScheduleTemplateSets,
              chekiRecruitments,
              appliedChekiShiftIds,
            },
            userId,
          )
        : saveChekiApplications(userId, appliedChekiShiftIds);

      savePromise
        .then(() => {
          lastSavedSnapshotRef.current = snapshot;
          setSaveStatus("保存済み");
        })
        .catch((error: Error) => {
          setSaveStatus("保存失敗");
          setLoadError(error.message);
        });
    }, 700);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    appliedChekiShiftIds,
    groups,
    chekiRecruitments,
    isDataReady,
    isLoadingData,
    isApprovedUser,
    isEmployee,
    needsPasswordSetup,
    projects,
    runScheduleTemplateSets,
    taskTemplateSets,
    userId,
  ]);

  useEffect(() => {
    if (!authEnabled || !isAdmin || !isApprovedUser) {
      setUserProfiles([]);
      return;
    }

    let cancelled = false;
    loadUserProfiles()
      .then((profiles) => {
        if (!cancelled) setUserProfiles(profiles);
      })
      .catch((error: Error) => {
        if (!cancelled) setUserManagementMessage(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, isApprovedUser]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    if (error) {
      setAuthMessage(error.message);
      return;
    }
    setAuthPassword("");
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthMessage("");

    const email = authEmail.trim();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: authRedirectUrl,
        data: {
          password_set: false,
        },
      },
    });

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setAuthMessage("確認メールを送信しました。メール内のリンクからパスワード設定へ進んでください。");
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
      redirectTo: authRedirectUrl,
    });

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setAuthMessage("パスワード再設定メールを送信しました。メール内のリンクから再設定してください。");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;
    setAuthMessage("");

    if (authPassword.length < 8) {
      setAuthMessage("パスワードは8文字以上にしてください。");
      return;
    }
    if (authPassword !== authPasswordConfirm) {
      setAuthMessage("確認用パスワードが一致していません。");
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({
      password: authPassword,
      data: {
        ...session.user.user_metadata,
        password_set: true,
      },
    });
    setIsUpdatingPassword(false);

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setRecoveryMode(false);
    setAuthPassword("");
    setAuthPasswordConfirm("");
    setAuthMessage("");
    await supabase.auth.refreshSession();
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function refreshUserProfiles() {
    if (!isAdmin) return;
    setUserManagementMessage("");
    try {
      setUserProfiles(await loadUserProfiles());
    } catch (error) {
      setUserManagementMessage(error instanceof Error ? error.message : "ユーザー一覧を取得できませんでした。");
    }
  }

  async function changeUserProfile(userIdToUpdate: string, updates: Pick<AppUserProfile, "role" | "status">) {
    if (!isAdmin) return;
    if (userIdToUpdate === userId && (updates.role !== "admin" || updates.status !== "active")) {
      setUserManagementMessage("自分自身を管理者・有効状態から外す操作はできません。");
      return;
    }

    setUserManagementMessage("保存中");
    try {
      const updated = await updateUserProfile(userIdToUpdate, updates);
      setUserProfiles((current) =>
        current.map((profile) => (profile.id === updated.id ? { ...profile, ...updated } : profile)),
      );
      if (updated.id === userId) setCurrentUserProfile(updated);
      setUserManagementMessage("保存しました");
    } catch (error) {
      setUserManagementMessage(error instanceof Error ? error.message : "ユーザー情報を更新できませんでした。");
    }
  }

  async function deleteManagedUserProfile(userIdToDelete: string) {
    if (!isAdmin) return;
    if (userIdToDelete === userId) {
      setUserManagementMessage("自分自身は削除できません。");
      return;
    }

    const profile = userProfiles.find((current) => current.id === userIdToDelete);
    const label = profile?.email || "このユーザー";
    if (!window.confirm(`${label} をユーザー管理から削除します。よろしいですか？`)) return;

    setUserManagementMessage("削除中");
    try {
      await deleteUserProfile(userIdToDelete);
      setUserProfiles((current) => current.filter((current) => current.id !== userIdToDelete));
      setUserManagementMessage("削除しました");
    } catch (error) {
      setUserManagementMessage(error instanceof Error ? error.message : "ユーザーを削除できませんでした。");
    }
  }

  async function sendManagedUserLineTest(userIdToNotify: string) {
    if (!isAdmin) return;
    const profile = userProfiles.find((current) => current.id === userIdToNotify);
    if (!profile?.lineLinkedAt) {
      setUserManagementMessage("このユーザーはLINE連携が完了していません。");
      return;
    }

    setLineTestSendingUserId(userIdToNotify);
    setUserManagementMessage("LINEテスト通知を送信中");
    try {
      const result = await sendLineTestNotification(userIdToNotify);
      const details = [
        result.lineResponseStatus ? `LINE ${result.lineResponseStatus}` : "",
        result.lineUserSuffix ? `送信先末尾 ${result.lineUserSuffix}` : "",
        result.sentAt ? `送信 ${formatDateTime(result.sentAt)}` : "",
      ]
        .filter(Boolean)
        .join(" / ");
      setUserManagementMessage(`LINEテスト通知を送信しました${details ? `（${details}）` : ""}`);
    } catch (error) {
      setUserManagementMessage(error instanceof Error ? error.message : "LINEテスト通知を送信できませんでした。");
    } finally {
      setLineTestSendingUserId("");
    }
  }

  const groupProjects = useMemo(
    () =>
      projects
        .filter((project) => project.group === activeGroup)
        .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()),
    [activeGroup, projects],
  );

  useEffect(() => {
    const calendarUrl = activeGroupProfile?.calendarUrl;
    if (!calendarUrl) {
      setExternalCalendarItems([]);
      return;
    }

    let cancelled = false;
    loadGoogleCalendarItems(calendarUrl, activeGroup)
      .then((items) => {
        if (!cancelled) setExternalCalendarItems(items);
      })
      .catch(() => {
        if (!cancelled) setExternalCalendarItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeGroup, activeGroupProfile?.calendarUrl]);

  const calendarItems = [
    ...groupProjects
    .flatMap((project) => {
      const milestoneItems = [
        {
          id: `${project.id}-ticket`,
          date: project.ticketLaunch.slice(0, 10),
          time: project.ticketLaunch.includes("T") ? project.ticketLaunch.split("T")[1].slice(0, 5) : "",
          title: "チケット発売",
          liveTitle: project.title,
          kind: "チケット",
          liveId: project.id,
        },
        {
          id: `${project.id}-photo`,
          date: extractDate(project.photoShoot),
          time: extractTime(project.photoShoot),
          title: "撮影",
          liveTitle: project.title,
          kind: "撮影",
          liveId: project.id,
        },
        {
          id: `${project.id}-rehearsal`,
          date: extractDate(project.rehearsal),
          time: extractTime(project.rehearsal),
          title: "ゲネプロ",
          liveTitle: project.title,
          kind: "ゲネ",
          liveId: project.id,
        },
        {
          id: `${project.id}-event`,
          date: project.eventDate,
          time: "",
          title: "ライブ当日",
          liveTitle: project.title,
          kind: inferCalendarLiveKind(project.title),
          liveId: project.id,
        },
      ];

      const taskItems = project.tasks
        .filter((task) => task.status !== "完了")
        .map((task) => ({
          id: `${project.id}-${task.id}`,
          date: task.dueDate,
          time: "",
          title: task.title,
          liveTitle: project.title,
          kind: "タスク",
          liveId: project.id,
          taskId: task.id,
          taskStatus: task.status,
        }));

      return [...milestoneItems.filter((item) => isIsoDate(item.date)), ...taskItems];
    }),
    ...externalCalendarItems,
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const liveListProjects = groupProjects.filter((project) =>
    liveListView === "完" ? project.status === "完了" : project.status !== "完了",
  );
  const unmanagedCalendarItems = externalCalendarItems
    .filter((item) => isExternalCalendarLiveItem(item))
    .filter((item) => {
      const matchedProject = groupProjects.find((project) => isSameCalendarLive(project, item, activeGroup));
      if (!matchedProject) return true;
      const isFutureOrToday = toDate(item.date) >= today;
      if (isFutureOrToday) return matchedProject.status === "完了";
      return matchedProject.status !== "完了";
    });
  const calendarLiveItems = unmanagedCalendarItems
    .filter((item) => (liveListView === "完" ? toDate(item.date) < today : toDate(item.date) >= today))
    .sort((a, b) => `${a.date}${a.time}${a.title}`.localeCompare(`${b.date}${b.time}${b.title}`));
  const liveListCounts: Record<LiveListView, number> = {
    未:
      groupProjects.filter((project) => project.status !== "完了").length +
      unmanagedCalendarItems.filter((item) => toDate(item.date) >= today).length,
    完:
      groupProjects.filter((project) => project.status === "完了").length +
      unmanagedCalendarItems.filter((item) => toDate(item.date) < today).length,
  };
  const selectedLive =
    groupProjects.find((project) => project.id === selectedLiveId) ?? groupProjects[0] ?? null;

  const searchedProjects = liveListProjects.filter((project) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return `${project.title} ${project.venue}`.toLowerCase().includes(text);
  });
  const searchedCalendarLiveItems = calendarLiveItems.filter((item) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return `${item.title} ${item.liveTitle}`.toLowerCase().includes(text);
  });

  const groupTasks = groupProjects.flatMap((project) => project.tasks);
  const liveTasks = selectedLive
    ? selectedLive.tasks.map((task) => ({
      ...task,
      liveId: selectedLive.id,
      liveTitle: selectedLive.title,
      eventDate: selectedLive.eventDate,
    }))
    : [];
  const ownerFilteredTasks =
    taskOwnerFilter === "全員" ? liveTasks : liveTasks.filter((task) => task.owner === taskOwnerFilter);
  const roleAndOwnerFilteredTasks =
    taskRoleFilter === "全ロール"
      ? ownerFilteredTasks
      : ownerFilteredTasks.filter((task) => getTaskRole(task) === taskRoleFilter);
  const ownerFilterOptions = ["全員", ...managers];
  const roleFilterOptions = taskRoleFilters;

  const visibleTasks = roleAndOwnerFilteredTasks
    .filter((task) => matchesTaskView(task, taskView))
    .sort((a, b) => {
      const lateSort = Number(isLate(b)) - Number(isLate(a));
      if (lateSort !== 0) return lateSort;
      const prioritySort = priorityRank(a.priority) - priorityRank(b.priority);
      if (prioritySort !== 0) return prioritySort;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const taskCounts: Record<TaskView, number> = {
    未着手: roleAndOwnerFilteredTasks.filter((task) => matchesTaskView(task, "未着手")).length,
    進行中: roleAndOwnerFilteredTasks.filter((task) => matchesTaskView(task, "進行中")).length,
    完了済み: roleAndOwnerFilteredTasks.filter((task) => matchesTaskView(task, "完了済み")).length,
  };

  function openManagerIssue(issue: ManagerIssue) {
    const project = projects.find((currentProject) => currentProject.id === issue.liveId);
    const task = project?.tasks.find((currentTask) => currentTask.id === issue.taskId);

    setAppMode("work");
    setIsDrawerOpen(false);
    setActiveGroup(issue.group);
    setSelectedLiveId(issue.liveId);
    setLiveListView(project?.status === "完了" ? "完" : "未");
    setTaskRoleFilter("全ロール");
    setTaskOwnerFilter("全員");
    setQuery("");

    if (task) {
      const key = `${issue.liveId}-${task.id}`;
      setTaskView(taskViewFromStatus(task.status));
      setSelectedTaskKey(key);
      window.setTimeout(() => {
        document.getElementById(`task-${key}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 80);
      return;
    }

    setSelectedTaskKey(null);
  }

  function updateTaskScrollHint() {
    const element = taskListRef.current;
    if (!element) return;
    const top = element.scrollTop > 4;
    const bottom = element.scrollTop + element.clientHeight < element.scrollHeight - 4;
    setTaskScrollHint((current) =>
      current.top === top && current.bottom === bottom ? current : { top, bottom },
    );
  }

  function updateActionScrollHint() {
    const element = actionColumnRef.current;
    if (!element) return;
    const top = element.scrollTop > 4;
    const bottom = element.scrollTop + element.clientHeight < element.scrollHeight - 4;
    setActionScrollHint((current) =>
      current.top === top && current.bottom === bottom ? current : { top, bottom },
    );
  }

  function updateLiveListScrollHint() {
    const element = liveListRef.current;
    if (!element) return;
    const top = element.scrollTop > 4;
    const bottom = element.scrollTop + element.clientHeight < element.scrollHeight - 4;
    setLiveListScrollHint((current) =>
      current.top === top && current.bottom === bottom ? current : { top, bottom },
    );
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      updateTaskScrollHint();
      updateActionScrollHint();
      updateLiveListScrollHint();
    });
    const updateScrollHints = () => {
      updateTaskScrollHint();
      updateActionScrollHint();
      updateLiveListScrollHint();
    };
    window.addEventListener("resize", updateScrollHints);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateScrollHints);
    };
  }, [
    selectedLiveId,
    taskRoleFilter,
    taskView,
    taskOwnerFilter,
    visibleTasks.length,
    searchedProjects.length,
    searchedCalendarLiveItems.length,
    liveListView,
    query,
  ]);

  useEffect(() => {
    if (liveListProjects.length === 0) return;
    if (!liveListProjects.some((project) => project.id === selectedLiveId)) {
      setSelectedLiveId(liveListProjects[0].id);
      setTaskOwnerFilter("全員");
      setSelectedTaskKey(null);
    }
  }, [liveListProjects, selectedLiveId]);

  useEffect(() => {
    if (!isGroupEditorOpen) return;

    const closeGroupEditor = (event: PointerEvent) => {
      const target = event.target as Node;
      if (groupActionsRef.current?.contains(target) || groupEditorRef.current?.contains(target)) {
        return;
      }
      setIsGroupEditorOpen(false);
    };

    document.addEventListener("pointerdown", closeGroupEditor);
    return () => document.removeEventListener("pointerdown", closeGroupEditor);
  }, [isGroupEditorOpen]);

  function selectGroup(groupName: string) {
    const nextProject = projects
      .filter((project) => project.group === groupName && project.status !== "完了")
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];
    const fallbackProject = projects
      .filter((project) => project.group === groupName)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];
    const nextProfile = groups.find((group) => group.name === groupName) ?? groups[0];

    setActiveGroup(groupName);
    setLiveListView("未");
    setSelectedLiveId((nextProject ?? fallbackProject)?.id ?? "");
    setTaskView("未着手");
    setTaskRoleFilter("全ロール");
    setTaskOwnerFilter("全員");
    setQuery("");
    setNewLive((form) => ({
      ...form,
      group: groupName,
      manager: nextProfile.manager,
    }));
  }

  function resetGroupForm() {
    setEditingGroupName(null);
    setGroupForm({
      name: "",
      manager: managers[0],
      photo: "",
      calendarUrl: "",
    });
    setGroupNotice("");
  }

  function openNewGroupForm() {
    resetGroupForm();
    setIsGroupEditorOpen(true);
  }

  function editActiveGroup() {
    const group = groups.find((currentGroup) => currentGroup.name === activeGroup);
    if (!group) return;
    setEditingGroupName(group.name);
    setGroupForm({
      name: group.name,
      manager: group.manager,
      photo: group.photo,
      calendarUrl: group.calendarUrl ?? "",
    });
    setGroupNotice("");
    setIsGroupEditorOpen(true);
  }

  function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupForm.name.trim();
    const manager = groupForm.manager.trim() || managers[0];
    const photo = groupForm.photo.trim();
    const calendarUrl = groupForm.calendarUrl.trim();
    if (!name) {
      setGroupNotice("グループ名を入力してください。");
      return;
    }
    const duplicate = groups.some(
      (group) => group.name === name && group.name !== editingGroupName,
    );
    if (duplicate) {
      setGroupNotice("同じ名前のグループが既にあります。");
      return;
    }

    if (editingGroupName) {
      setGroups((current) =>
        current.map((group) =>
          group.name === editingGroupName
            ? { ...group, name, manager, photo, calendarUrl: calendarUrl || undefined }
            : group,
        ),
      );
      if (editingGroupName !== name) {
        setProjects((current) =>
          current.map((project) =>
            project.group === editingGroupName ? { ...project, group: name } : project,
          ),
        );
        if (activeGroup === editingGroupName) setActiveGroup(name);
        if (managerGroupFilter === editingGroupName) setManagerGroupFilter(name);
      }
      setNewLive((form) =>
        form.group === editingGroupName || activeGroup === name
          ? { ...form, group: name, manager }
          : form,
      );
      setGroupNotice("グループ情報を更新しました。");
      setEditingGroupName(name);
      setIsGroupEditorOpen(false);
      return;
    }

    const nextGroup = { id: `group-${crypto.randomUUID()}`, name, manager, photo, calendarUrl: calendarUrl || undefined };
    setGroups((current) => [...current, nextGroup]);
    setActiveGroup(name);
    setSelectedLiveId("");
    setLiveListView("未");
    setTaskView("未着手");
    setTaskRoleFilter("全ロール");
    setTaskOwnerFilter("全員");
    setQuery("");
    setNewLive((form) => ({ ...form, group: name, manager }));
    setEditingGroupName(name);
    setGroupNotice("グループを追加しました。続けてライブを追加できます。");
    setIsGroupEditorOpen(false);
  }

  function deleteActiveGroup() {
    const liveCount = projects.filter((project) => project.group === activeGroup).length;
    if (liveCount > 0) {
      setGroupNotice("ライブが登録されているグループは削除できません。");
      return;
    }
    if (groups.length <= 1) {
      setGroupNotice("最後のグループは削除できません。");
      return;
    }
    const nextGroups = groups.filter((group) => group.name !== activeGroup);
    const nextGroup = nextGroups[0];
    setGroups(nextGroups);
    setActiveGroup(nextGroup.name);
    setSelectedLiveId(
      projects
        .filter((project) => project.group === nextGroup.name && project.status !== "完了")
        .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0]?.id ??
        "",
    );
    setManagerGroupFilter((current) => (current === activeGroup ? "全グループ" : current));
    setNewLive((form) => ({ ...form, group: nextGroup.name, manager: nextGroup.manager }));
    resetGroupForm();
    setIsGroupEditorOpen(false);
  }

  function updateProject(projectId: string, updater: (project: LiveProject) => LiveProject) {
    setProjects((current) =>
      current.map((project) => (project.id === projectId ? updater(project) : project)),
    );
  }

  function setLiveStatus(projectId: string, status: LiveStatus) {
    updateProject(projectId, (project) => ({ ...project, status }));
    setLiveListView(status === "完了" ? "完" : "未");
  }

  function toggleTask(projectId: string, taskId: string) {
    updateProject(projectId, (project) => ({
      ...project,
      tasks: project.tasks.map((task) =>
        task.id === taskId
          ? updateTaskStatusValue(task, task.status === "完了" ? "未着手" : "完了")
          : task,
      ),
    }));
  }

  function setTaskStatus(projectId: string, taskId: string, status: TaskStatus) {
    updateProject(projectId, (project) => ({
      ...project,
      tasks: project.tasks.map((task) => (task.id === taskId ? updateTaskStatusValue(task, status) : task)),
    }));
  }

  function deleteTask(projectId: string, taskId: string) {
    updateProject(projectId, (project) => ({
      ...project,
      tasks: project.tasks.filter((task) => task.id !== taskId),
    }));
    setSelectedTaskKey((current) => (current === `${projectId}-${taskId}` ? null : current));
  }

  function toggleSubtask(projectId: string, taskId: string, subtaskId: string) {
    updateProject(projectId, (project) => ({
      ...project,
      tasks: project.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: task.subtasks?.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
              ),
            }
          : task,
      ),
    }));
  }

  function addSubtask(projectId: string, taskId: string, title: string) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    updateProject(projectId, (project) => ({
      ...project,
      tasks: project.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: [
                ...(task.subtasks ?? []),
                {
                  id: `${task.id}-subtask-${crypto.randomUUID()}`,
                  title: trimmedTitle,
                  done: false,
                },
              ],
            }
          : task,
      ),
    }));
  }

  function updateTicket(projectId: string, ticketId: string, updates: Partial<TicketPlan>) {
    updateProject(projectId, (project) => ({
      ...project,
      tickets: project.tickets.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, ...updates } : ticket,
      ),
    }));
  }

  function addTicket(projectId: string) {
    const id = `ticket-${crypto.randomUUID()}`;
    updateProject(projectId, (project) => ({
      ...project,
      tickets: [
        ...project.tickets,
        {
          id,
          name: "新規券種",
          price: 0,
          saleStart: `${toIsoDate(today)}T20:00`,
          benefit: "",
          status: "未作成",
        },
      ],
    }));
    return id;
  }

  function deleteTicket(projectId: string, ticketId: string) {
    updateProject(projectId, (project) => ({
      ...project,
      tickets: project.tickets.filter((ticket) => ticket.id !== ticketId),
    }));
  }

  function updateProductionItem(projectId: string, itemId: string, updates: Partial<ProductionItem>) {
    updateProject(projectId, (project) => ({
      ...project,
      productionItems: project.productionItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    }));
  }

  function addProductionItem(projectId: string) {
    const id = `item-${crypto.randomUUID()}`;
    updateProject(projectId, (project) => ({
      ...project,
      productionItems: [
        ...project.productionItems,
        {
          id,
          name: "新規制作物",
          owner: project.manager,
          designer: "",
          vendor: "未設定",
          dueDate: addDays(toDate(project.eventDate), -14),
          status: "未依頼",
          memo: "",
        },
      ],
    }));
    return id;
  }

  function deleteProductionItem(projectId: string, itemId: string) {
    updateProject(projectId, (project) => ({
      ...project,
      productionItems: project.productionItems.filter((item) => item.id !== itemId),
    }));
  }

  function updateScheduleItems(projectId: string, scheduleItems: RunScheduleItem[]) {
    updateProject(projectId, (project) => ({
      ...project,
      scheduleItems,
    }));
  }

  function saveRunScheduleTemplate(template: RunScheduleTemplateSet) {
    setRunScheduleTemplateSets((current) => {
      const exists = current.some((item) => item.id === template.id);
      if (exists) return current.map((item) => (item.id === template.id ? template : item));
      return [...current, template];
    });
    setSelectedRunScheduleTemplateId(template.id);
  }

  function updateLiveDriveFolderUrl(projectId: string, driveFolderUrl: string) {
    updateProject(projectId, (project) => ({
      ...project,
      driveFolderUrl,
    }));
  }

  function moveTaskDueDate(projectId: string, taskId: string, dueDate: string) {
    const targetTask = projects.find((project) => project.id === projectId)?.tasks.find((task) => task.id === taskId);
    updateProject(projectId, (project) => ({
      ...project,
      tasks: project.tasks.map((task) => (task.id === taskId ? { ...task, dueDate } : task)),
    }));
    setSelectedLiveId(projectId);
    setSelectedTaskKey(`${projectId}-${taskId}`);
    if (targetTask) setTaskView(taskViewFromStatus(targetTask.status));
    setTaskRoleFilter("全ロール");
    setTaskOwnerFilter("全員");
    setNewTaskDueDate(dueDate);
  }

  function addQuickTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || !selectedLive || !newTaskDueDate) return;

    const task: Task = {
      id: `task-${crypto.randomUUID()}`,
      phase: inferPhase(title),
      title,
      dueDate: newTaskDueDate,
      owner: newTaskOwner,
      priority: "通常",
      status: "未着手",
    };
    task.subtasks = buildSubtasks(task.id, title);

    updateProject(selectedLive.id, (project) => ({
      ...project,
      tasks: [...project.tasks, task],
    }));
    setNewTaskTitle("");
    setNewTaskDueDate("");
    setTaskView("未着手");
  }

  function openTemplateEditor() {
    const template =
      selectedCreateTemplate ??
      createBlankTaskTemplateSet(selectedLive?.manager ?? activeGroupProfile?.manager ?? managers[0]);
    setTemplateDraft(cloneTaskTemplateSet(template));
    setIsDrawerOpen(false);
    setIsTemplateEditorOpen(true);
  }

  function startNewTemplateDraft() {
    setTemplateDraft(createBlankTaskTemplateSet(selectedLive?.manager ?? activeGroupProfile?.manager ?? managers[0]));
  }

  function updateTemplateDraftItem(itemId: string, updates: Partial<TaskTemplateItem>) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    }));
  }

  function addTemplateDraftItem() {
    setTemplateDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: `template-item-${crypto.randomUUID()}`,
          phase: "イベント",
          title: "",
          offset: -30,
          owner: selectedLive?.manager ?? activeGroupProfile?.manager ?? managers[0],
          priority: "通常",
          subtasks: [],
        },
      ],
    }));
  }

  function deleteTemplateDraftItem(itemId: string) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.length <= 1 ? current.items : current.items.filter((item) => item.id !== itemId),
    }));
  }

  function saveTaskTemplate() {
    const name = templateDraft.name.trim();
    const items = templateDraft.items
      .map((item) => ({
        ...item,
        title: item.title.trim(),
        memo: item.memo?.trim() || undefined,
        subtasks: item.subtasks.map((subtask) => subtask.trim()).filter(Boolean),
      }))
      .filter((item) => item.title);

    if (!name || items.length === 0) return;

    const savedTemplate: TaskTemplateSet = {
      ...templateDraft,
      name,
      items,
    };

    setTaskTemplateSets((current) => {
      const exists = current.some((template) => template.id === savedTemplate.id);
      if (exists) {
        return current.map((template) => (template.id === savedTemplate.id ? savedTemplate : template));
      }
      return [...current, savedTemplate];
    });
    setSelectedCreateTemplateId(savedTemplate.id);
    setIsTemplateEditorOpen(false);
  }

  function applyTaskTemplateToSelectedLive() {
    if (!selectedLive || !selectedCreateTemplate) return;

    if (
      selectedLive.tasks.length > 0 &&
      !window.confirm("このライブにテンプレートのタスクを追加します。既存タスクは残します。よろしいですか？")
    ) {
      return;
    }

    updateProject(selectedLive.id, (project) => {
      const existingTitles = new Set(project.tasks.map((task) => normalizeSearchText(task.title)));
      const templateTasks = generateTasks(project.id, project.eventDate, selectedCreateTemplate.items).filter(
        (task) => !existingTitles.has(normalizeSearchText(task.title)),
      );

      if (templateTasks.length === 0) return project;

      return {
        ...project,
        tasks: [...project.tasks, ...templateTasks],
      };
    });
    setTaskView("未着手");
    setSelectedTaskKey(null);
  }

  function selectCalendarLive(item: CalendarItem) {
    const draft = calendarItemToLiveDraft(item, activeGroup);
    const existingProject = groupProjects.find(
      (project) => isSameCalendarLive(project, item, activeGroup),
    );

    if (existingProject) {
      const isPast = toDate(item.date) < today;
      if (isPast && existingProject.status !== "完了") {
        updateProject(existingProject.id, (project) => ({
          ...project,
          status: "完了",
          sourceCalendarEventId: item.id,
        }));
        setLiveListView("完");
      } else if (!isPast && existingProject.status === "完了") {
        updateProject(existingProject.id, (project) => ({
          ...project,
          status: "計画",
          sourceCalendarEventId: item.id,
        }));
        setLiveListView("未");
      } else if (!existingProject.sourceCalendarEventId) {
        updateProject(existingProject.id, (project) => ({
          ...project,
          sourceCalendarEventId: item.id,
        }));
      }
      setSelectedLiveId(existingProject.id);
      setTaskRoleFilter("全ロール");
      setTaskOwnerFilter("全員");
      setSelectedTaskKey(null);
      setIsDrawerOpen(false);
      return;
    }

    const profile = groups.find((group) => group.name === activeGroup);
    const id = `live-${crypto.randomUUID()}`;
    const manager = profile?.manager ?? managers[0];
    const venue = draft.venue || "未設定";
    const status: LiveStatus = toDate(item.date) < today ? "完了" : "計画";
    const live: LiveProject = {
      id,
      group: activeGroup,
      title: draft.title || item.title.trim(),
      venue,
      eventDate: item.date,
      status,
      manager,
      liveType: draft.liveType,
      ticketLaunch: "",
      rehearsal: "",
      photoShoot: "",
      productionCompany: "未設定",
      sourceCalendarEventId: item.id,
      tasks: [],
      tickets: [],
      productionItems: [],
      scheduleItems: [],
    };

    setProjects((current) => [live, ...current]);
    setSelectedLiveId(live.id);
    setTaskView("未着手");
    setTaskRoleFilter("全ロール");
    setTaskOwnerFilter("全員");
    setSelectedTaskKey(null);
    setIsTemplateEditorOpen(false);
    setIsScheduleOpen(false);
    setIsDrawerOpen(false);
  }

  function createLive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newLive.title.trim() || !newLive.venue.trim() || !newLive.eventDate) return;

    const id = `live-${crypto.randomUUID()}`;
    const generatedTasks = selectedCreateTemplate
      ? generateTasks(id, newLive.eventDate, selectedCreateTemplate.items)
      : [];
    const generatedScheduleItems = selectedRunScheduleTemplate
      ? buildRunScheduleFromTemplate(id, selectedRunScheduleTemplate.items)
      : [];
    const live: LiveProject = {
      id,
      group: activeGroup,
      title: newLive.title.trim(),
      venue: newLive.venue.trim(),
      eventDate: newLive.eventDate,
      status: "計画",
      manager: newLive.manager,
      liveType: newLive.liveType,
      ticketLaunch: "",
      rehearsal: "",
      photoShoot: "",
      productionCompany: "未設定",
      tasks: generatedTasks,
      tickets: [],
      productionItems: [],
      scheduleItems: generatedScheduleItems,
    };

    setProjects((current) => [live, ...current]);
    setSelectedLiveId(live.id);
    setTaskView("未着手");
    setIsDrawerOpen(false);
    setNewLive((form) => ({
      ...form,
      title: "",
      venue: "",
      eventDate: "",
    }));
  }

  if (!isSupabaseConfigured && authEnabled) {
    return <SetupScreen />;
  }

  if (authEnabled && !session) {
    return (
      <AuthScreen
        email={authEmail}
        message={authMessage || lineLinkMessage}
        password={authPassword}
        view={authView}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onRequestPasswordReset={requestPasswordReset}
        onSignIn={signIn}
        onSignUp={signUp}
        onViewChange={(view) => {
          setAuthView(view);
          setAuthMessage("");
          setAuthPassword("");
        }}
      />
    );
  }

  if (authEnabled && needsPasswordSetup) {
    return (
      <PasswordSetupScreen
        confirmPassword={authPasswordConfirm}
        isSubmitting={isUpdatingPassword}
        message={authMessage}
        password={authPassword}
        recoveryMode={recoveryMode}
        onConfirmPasswordChange={setAuthPasswordConfirm}
        onPasswordChange={setAuthPassword}
        onSubmit={updatePassword}
      />
    );
  }

  if (authEnabled && isProfileLoading) {
    return <LoadingScreen message="ユーザー権限を確認しています" />;
  }

  if (authEnabled && isLineLinking) {
    return <LoadingScreen message={lineLinkMessage || "LINE連携を準備しています"} />;
  }

  if (authEnabled && loadError && !currentUserProfile) {
    return <AccessStatusScreen email={session?.user.email ?? ""} message={loadError} status="error" onSignOut={signOut} />;
  }

  if (authEnabled && currentUserProfile?.status !== "active") {
    return (
      <AccessStatusScreen
        email={currentUserProfile?.email ?? session?.user.email ?? ""}
        status={currentUserProfile?.status ?? "pending"}
        onSignOut={signOut}
      />
    );
  }

  if (!isDataReady || isLoadingData) {
    return <LoadingScreen message={loadError || "データを読み込んでいます"} />;
  }

  return (
    <div className="app">
      {lineLinkError && (
        <div className="globalNotice error" role="alert">
          {lineLinkError}
        </div>
      )}
      <header className="topBar">
        <div className="modeSwitch" aria-label="表示切り替え">
          {isEmployee && (
            <>
              <button
                className={effectiveAppMode === "work" ? "active" : ""}
                onClick={() => setAppMode("work")}
                type="button"
              >
                作業
              </button>
              <button
                className={effectiveAppMode === "manager" ? "active" : ""}
                onClick={() => {
                  setIsDrawerOpen(false);
                  setAppMode("manager");
                }}
                type="button"
              >
                管理
              </button>
            </>
          )}
          <button
            className={effectiveAppMode === "cheki" ? "active" : ""}
            onClick={() => {
              setIsDrawerOpen(false);
              setAppMode("cheki");
            }}
            type="button"
          >
            チェキスタッフ
          </button>
        </div>
      </header>

      <main className={effectiveAppMode === "work" ? "groupPage" : "managerPage"}>
        {effectiveAppMode === "manager" ? (
          <ManagerView
            groups={groups}
            currentUserId={userId ?? ""}
            isAdmin={isAdmin}
            managerSection={managerSection}
            managerContactFilter={managerContactFilter}
            managerGroupFilter={managerGroupFilter}
            managerRoleFilter={managerRoleFilter}
            projects={projects}
            selectedManagerIssueId={selectedManagerIssueId}
            selectedManagerLiveId={selectedManagerLiveId}
            setManagerContactFilter={setManagerContactFilter}
            setManagerGroupFilter={setManagerGroupFilter}
            setManagerRoleFilter={setManagerRoleFilter}
            setManagerSection={setManagerSection}
            setSelectedManagerIssueId={setSelectedManagerIssueId}
            setSelectedManagerLiveId={setSelectedManagerLiveId}
            lineTestSendingUserId={lineTestSendingUserId}
            userManagementMessage={userManagementMessage}
            userProfiles={userProfiles}
            onOpenIssue={openManagerIssue}
            onLineTestSend={sendManagedUserLineTest}
            onUserProfileDelete={deleteManagedUserProfile}
            onUserProfileChange={changeUserProfile}
          />
        ) : effectiveAppMode === "cheki" ? (
          <ChekiStaffView
            appliedShiftIds={appliedChekiShiftIds}
            chekiRecruitments={chekiRecruitments}
            groups={groups}
            projects={projects}
            onAppliedShiftIdsChange={setAppliedChekiShiftIds}
          />
        ) : (
        <section className="workGrid">
          <aside className="liveRail">
            <section className="sidePanel">
              <div className="panelTitle groupPanelTitle">
                <div>
                  <h2>グループ</h2>
                </div>
                <div className="groupHeaderActions" ref={groupActionsRef}>
                  <button onClick={openNewGroupForm} type="button">
                    <Plus size={14} />
                    新規
                  </button>
                  <button
                    disabled={!groups.some((group) => group.name === activeGroup)}
                    onClick={editActiveGroup}
                    type="button"
                  >
                    <Pencil size={14} />
                    編集
                  </button>
                  <button
                    className="danger"
                    disabled={
                      !groups.some((group) => group.name === activeGroup) ||
                      projects.some((project) => project.group === activeGroup) ||
                      groups.length <= 1
                    }
                    onClick={deleteActiveGroup}
                    type="button"
                  >
                    <Trash2 size={14} />
                    削除
                  </button>
                </div>
              </div>
              <GroupList
                activeGroup={activeGroup}
                groups={groups}
                projects={projects}
                onSelect={selectGroup}
              />
              {isGroupEditorOpen && (
                <GroupEditor
                  editingGroupName={editingGroupName}
                  editorRef={groupEditorRef}
                  form={groupForm}
                  notice={groupNotice}
                  onChange={setGroupForm}
                  onSubmit={saveGroup}
                />
              )}
            </section>

            <section className="sidePanel">
              <div className="panelTitle panelTitleAction">
                <div>
                  <h2>ライブ一覧</h2>
                </div>
                <button
                  className="miniScheduleButton"
                  disabled={!selectedLive}
                  onClick={() => setIsScheduleOpen(true)}
                  type="button"
                >
                  <CalendarDays size={15} />
                  前日/当日
                </button>
                <button
                  className="miniAddButton"
                  onClick={() => {
                    const profile = groups.find((group) => group.name === activeGroup);
                    setNewLive((form) => ({
                      ...form,
                      group: activeGroup,
                      manager: profile?.manager ?? form.manager,
                    }));
                    setIsDrawerOpen(true);
                  }}
                  type="button"
                >
                  <Plus size={15} />
                  追加
                </button>
              </div>
              <label className="searchBox">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ライブ・会場で検索"
                />
              </label>
              <div className="liveListViews">
                {(["未", "完"] as LiveListView[]).map((view) => (
                  <button
                    className={liveListView === view ? "active" : ""}
                    key={view}
                    onClick={() => setLiveListView(view)}
                    type="button"
                  >
                    {view}
                    <span>{liveListCounts[view]}</span>
                  </button>
                ))}
              </div>
              <div className="liveListWrap">
                {liveListScrollHint.top && (
                  <div className="groupScrollHint groupScrollHintTop">
                    <ChevronUp size={14} />
                  </div>
                )}
                <div className="liveList" onScroll={updateLiveListScrollHint} ref={liveListRef}>
                  {searchedProjects.map((project) => (
                    <LiveCard
                      key={project.id}
                      project={project}
                      selected={project.id === selectedLive?.id}
                      onSelect={() => {
                        setSelectedLiveId(project.id);
                        setTaskRoleFilter("全ロール");
                        setTaskOwnerFilter("全員");
                      }}
                    />
                  ))}
                  {searchedCalendarLiveItems.map((item) => (
                    <ExternalLiveCard item={item} key={item.id} onSelect={() => selectCalendarLive(item)} />
                  ))}
                  {searchedProjects.length === 0 && searchedCalendarLiveItems.length === 0 && (
                    <div className="miniEmpty">表示するライブはありません</div>
                  )}
                </div>
                {liveListScrollHint.bottom && (
                  <div className="groupScrollHint groupScrollHintBottom">
                    <ChevronDown size={14} />
                  </div>
                )}
              </div>
            </section>
          </aside>

          <aside className="calendarColumn">
            <section className="sidePanel">
              <CalendarPanel
                items={calendarItems}
                anchorDate={selectedLive?.eventDate || newLive.eventDate || toIsoDate(today)}
                selectedMarkerDate={isDrawerOpen ? newLive.eventDate : newTaskDueDate}
                selectedMarkerLabel={isDrawerOpen ? "開催" : "締切"}
                onSelectDate={(date) => {
                  if (isDrawerOpen) {
                    setNewLive((form) => ({ ...form, eventDate: date }));
                    return;
                  }
                  setNewTaskDueDate(date);
                }}
                onMoveTask={(liveId, taskId, date) => {
                  moveTaskDueDate(liveId, taskId, date);
                }}
                onSelectItem={(item) => {
                  if (item.readonly || !item.liveId) return;
                  setSelectedLiveId(item.liveId);
                  setTaskRoleFilter("全ロール");
                  setTaskOwnerFilter("全員");
                  if (!item.taskId) {
                    setSelectedTaskKey(null);
                    return;
                  }

                  const key = `${item.liveId}-${item.taskId}`;
                  setTaskView(taskViewFromStatus(item.taskStatus ?? "未着手"));
                  setSelectedTaskKey(key);
                  window.setTimeout(() => {
                    document.getElementById(`task-${key}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }, 80);
                }}
              />
            </section>
          </aside>

          <section className="contentArea">
            <div className="taskPane">
              <section className="mainPanel taskColumn">
                <div className="panelHead taskPanelHead">
                  <div>
                    <h2>タスク</h2>
                  </div>
                  <div className="taskHeaderStack">
                    <div className="taskControls">
                      <button className="templateButton" onClick={openTemplateEditor} type="button">
                        <CopyPlus size={14} />
                        テンプレート
                      </button>
                      <button
                        className="templateButton"
                        disabled={!selectedLive || !selectedCreateTemplate}
                        onClick={applyTaskTemplateToSelectedLive}
                        type="button"
                      >
                        <Plus size={14} />
                        読込
                      </button>
                      <label className="ownerSelect roleSelect">
                        <select
                          aria-label="ロールフィルター"
                          value={taskRoleFilter}
                          onChange={(event) => setTaskRoleFilter(event.target.value as TaskRoleFilter)}
                        >
                          {roleFilterOptions.map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                      <label className="ownerSelect">
                        <select
                          aria-label="担当者フィルター"
                          value={taskOwnerFilter}
                          onChange={(event) => setTaskOwnerFilter(event.target.value)}
                        >
                          {ownerFilterOptions.map((owner) => (
                            <option key={owner}>{owner}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>
                    <div className="taskViews">
                      {(["未着手", "進行中", "完了済み"] as TaskView[]).map((view) => (
                        <button
                          className={taskView === view ? "active" : ""}
                          key={view}
                          onClick={() => setTaskView(view)}
                          type="button"
                        >
                          {view}
                          <span>{taskCounts[view]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <form className="quickAdd" onSubmit={addQuickTask}>
                  <input
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="タスク名"
                  />
                  <input
                    aria-label="締切"
                    className="taskDateInput"
                    type="date"
                    value={newTaskDueDate}
                    onChange={(event) => setNewTaskDueDate(event.target.value)}
                  />
                  <select
                    aria-label="担当"
                    value={newTaskOwner}
                    onChange={(event) => setNewTaskOwner(event.target.value)}
                  >
                    {managers.map((manager) => (
                      <option key={manager}>{manager}</option>
                    ))}
                  </select>
                  <button type="submit">追加</button>
                </form>

                <div className="taskList" onScroll={updateTaskScrollHint} ref={taskListRef}>
                  {visibleTasks.map((task) => (
                    <TaskRow
                      key={`${task.liveId}-${task.id}`}
                      task={task}
                      selected={selectedTaskKey === `${task.liveId}-${task.id}`}
                      onSelectLive={() => {
                        const key = `${task.liveId}-${task.id}`;
                        setSelectedLiveId(task.liveId);
                        setSelectedTaskKey((current) => (current === key ? null : key));
                      }}
                      onToggle={() => toggleTask(task.liveId, task.id)}
                      onStatusChange={(status) => setTaskStatus(task.liveId, task.id, status)}
                      onDelete={() => deleteTask(task.liveId, task.id)}
                      onSubtaskToggle={(subtaskId) => toggleSubtask(task.liveId, task.id, subtaskId)}
                      onSubtaskAdd={(title) => addSubtask(task.liveId, task.id, title)}
                    />
                  ))}
                  {visibleTasks.length === 0 && (
                    <div className="emptyState">
                      <CheckCircle2 size={24} />
                      <span>表示するタスクはありません</span>
                    </div>
                  )}
                </div>
              </section>
              {!isDrawerOpen && taskScrollHint.top && (
                <div className="scrollHint scrollHintTop">
                  <ChevronUp size={16} />
                </div>
              )}
              {!isDrawerOpen && taskScrollHint.bottom && (
                <div className="scrollHint scrollHintBottom">
                  <ChevronDown size={16} />
                </div>
              )}
            </div>

            <div className="actionPane">
              <aside className="actionColumn" onScroll={updateActionScrollHint} ref={actionColumnRef}>
                <section className="sidePanel">
                  {selectedLive ? (
                    <LiveSummary
                      project={selectedLive}
                      onAddProductionItem={() => addProductionItem(selectedLive.id)}
                      onAddTicket={() => addTicket(selectedLive.id)}
                      onDeleteProductionItem={(itemId) => deleteProductionItem(selectedLive.id, itemId)}
                      onDeleteTicket={(ticketId) => deleteTicket(selectedLive.id, ticketId)}
                      onLiveStatusChange={(status) => setLiveStatus(selectedLive.id, status)}
                      onLiveDetailChange={(updates) =>
                        updateProject(selectedLive.id, (project) => ({ ...project, ...updates }))
                      }
                      onDriveFolderUrlChange={(driveFolderUrl) =>
                        updateLiveDriveFolderUrl(selectedLive.id, driveFolderUrl)
                      }
                      onTicketChange={(ticketId, updates) => updateTicket(selectedLive.id, ticketId, updates)}
                      onProductionItemChange={(itemId, updates) =>
                        updateProductionItem(selectedLive.id, itemId, updates)
                      }
                    />
                  ) : (
                    <div className="emptyState liveEmptyState">
                      <CalendarDays size={24} />
                      <span>左のライブ一覧からライブを選択してください</span>
                    </div>
                  )}
                </section>
              </aside>
              {!isDrawerOpen && actionScrollHint.top && (
                <div className="scrollHint scrollHintTop">
                  <ChevronUp size={16} />
                </div>
              )}
              {!isDrawerOpen && actionScrollHint.bottom && (
                <div className="scrollHint scrollHintBottom">
                  <ChevronDown size={16} />
                </div>
              )}
            </div>

            {isTemplateEditorOpen && (
              <aside className="templateOverlay">
                <div className="drawerHeader templateHeader">
                  <div>
                    <h2>タスクテンプレート</h2>
                    <span>ライブ作成時に自動生成するタスクを管理します</span>
                  </div>
                  <button className="iconButton" onClick={() => setIsTemplateEditorOpen(false)} type="button">
                    <X size={20} />
                  </button>
                </div>

                <div className="templateTop">
                  {taskTemplateSets.length > 0 ? (
                    <label>
                      <span>編集するテンプレート</span>
                      <select
                        value={taskTemplateSets.some((template) => template.id === templateDraft.id) ? templateDraft.id : ""}
                        onChange={(event) => {
                          const template = taskTemplateSets.find((item) => item.id === event.target.value);
                          if (template) setTemplateDraft(cloneTaskTemplateSet(template));
                        }}
                      >
                        {taskTemplateSets.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="templateEmptyNotice">
                      まだタスクテンプレートはありません。新規で作成してください。
                    </div>
                  )}
                  <button className="secondaryButton" onClick={startNewTemplateDraft} type="button">
                    <Plus size={15} />
                    新規
                  </button>
                </div>

                <div className="templateMeta">
                  <label>
                    <span>テンプレート名</span>
                    <input
                      value={templateDraft.name}
                      onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>対象</span>
                    <select
                      value={templateDraft.liveType}
                      onChange={(event) =>
                        setTemplateDraft((current) => ({
                          ...current,
                          liveType: event.target.value as TaskTemplateSet["liveType"],
                        }))
                      }
                    >
                      <option>共通</option>
                      <option>ワンマン</option>
                      <option>定期公演</option>
                      <option>生誕祭</option>
                    </select>
                  </label>
                </div>

                <div className="templateTaskList">
                  {templateDraft.items.map((item, index) => (
                    <section className="templateTaskCard" key={item.id}>
                      <div className="templateTaskHead">
                        <strong>{index + 1}</strong>
                        <input
                          aria-label="テンプレートタスク名"
                          value={item.title}
                          onChange={(event) => updateTemplateDraftItem(item.id, { title: event.target.value })}
                          placeholder="タスク名"
                        />
                        <button
                          className="iconButton compact"
                          disabled={templateDraft.items.length <= 1}
                          onClick={() => deleteTemplateDraftItem(item.id)}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="templateTaskFields">
                        <label>
                          <span>カテゴリ</span>
                          <select
                            value={item.phase}
                            onChange={(event) =>
                              updateTemplateDraftItem(item.id, { phase: event.target.value as Phase })
                            }
                          >
                            {phaseOrder.map((phase) => (
                              <option key={phase}>{phase}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>期日</span>
                          <select
                            value={item.offset}
                            onChange={(event) =>
                              updateTemplateDraftItem(item.id, { offset: Number(event.target.value) })
                            }
                          >
                            {[-120, -90, -75, -60, -45, -30, -21, -14, -7, -3, -1, 0].map((offset) => (
                              <option key={offset} value={offset}>
                                {offset === 0 ? "当日" : `${Math.abs(offset)}日前`}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>担当</span>
                          <select
                            value={item.owner}
                            onChange={(event) => updateTemplateDraftItem(item.id, { owner: event.target.value })}
                          >
                            {managers.map((manager) => (
                              <option key={manager}>{manager}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>重要度</span>
                          <select
                            value={item.priority}
                            onChange={(event) =>
                              updateTemplateDraftItem(item.id, { priority: event.target.value as Priority })
                            }
                          >
                            <option>必須</option>
                            <option>重要</option>
                            <option>通常</option>
                          </select>
                        </label>
                      </div>
                      <label className="templateSubtasks">
                        <span>サブタスク</span>
                        <textarea
                          value={item.subtasks.join("\n")}
                          onChange={(event) =>
                            updateTemplateDraftItem(item.id, {
                              subtasks: event.target.value.split(/\r?\n/),
                            })
                          }
                          placeholder="1行に1つずつ入力"
                        />
                      </label>
                    </section>
                  ))}
                </div>

                <div className="templateFooter">
                  <button className="secondaryButton" onClick={addTemplateDraftItem} type="button">
                    <Plus size={15} />
                    タスクを追加
                  </button>
                  <button className="primaryButton" onClick={saveTaskTemplate} type="button">
                    保存
                  </button>
                </div>
              </aside>
            )}

            {isDrawerOpen && (
              <aside className="createOverlay">
              <div className="drawerHeader">
                <div>
                  <h2>新規ライブ</h2>
                </div>
                <button className="iconButton" onClick={() => setIsDrawerOpen(false)} type="button">
                  <X size={20} />
                </button>
              </div>

              <form className="drawerForm" onSubmit={createLive}>
                <label>
                  <span>グループ</span>
                  <input readOnly value={activeGroup} />
                </label>
                <label>
                  <span>ライブタイトル</span>
                  <input
                    value={newLive.title}
                    onChange={(event) => setNewLive({ ...newLive, title: event.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>開催日</span>
                  <input
                    type="date"
                    value={newLive.eventDate}
                    onChange={(event) => setNewLive({ ...newLive, eventDate: event.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>会場</span>
                  <input
                    value={newLive.venue}
                    onChange={(event) => setNewLive({ ...newLive, venue: event.target.value })}
                    required
                  />
                </label>
                <div className="formSplit">
                  <label>
                    <span>種別</span>
                    <select
                      value={newLive.liveType}
                      onChange={(event) =>
                        setNewLive({ ...newLive, liveType: event.target.value as LiveType })
                      }
                    >
                      <option>ワンマン</option>
                      <option>定期公演</option>
                      <option>生誕祭</option>
                    </select>
                  </label>
                  <label>
                    <span>主担当</span>
                    <select
                      value={newLive.manager}
                      onChange={(event) => setNewLive({ ...newLive, manager: event.target.value })}
                    >
                      {managers.map((manager) => (
                        <option key={manager}>{manager}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  <span>タスクテンプレート</span>
                  {taskTemplateSets.length > 0 ? (
                    <select
                      value={selectedCreateTemplateId}
                      onChange={(event) => setSelectedCreateTemplateId(event.target.value)}
                    >
                      {taskTemplateSets.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} / {template.liveType}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="emptySelectLike">テンプレートなし</div>
                  )}
                </label>
                <label>
                  <span>進行表テンプレート</span>
                  <select
                    value={selectedRunScheduleTemplateId}
                    onChange={(event) => setSelectedRunScheduleTemplateId(event.target.value)}
                  >
                    {runScheduleTemplateSets.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} / {template.liveType}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primaryButton full" type="submit">
                  <CopyPlus size={18} />
                  作成
                </button>
              </form>
              </aside>
            )}

            {isScheduleOpen && selectedLive && (
              <aside className="scheduleOverlay">
                <div className="drawerHeader">
                  <div>
                    <span>Run sheet</span>
                    <h2>
                      {formatDate(selectedLive.eventDate)} {selectedLive.title}
                    </h2>
                  </div>
                  <button className="iconButton" onClick={() => setIsScheduleOpen(false)} type="button">
                    <X size={20} />
                  </button>
                </div>
                <RunScheduleManager
                  project={selectedLive}
                  runScheduleTemplates={runScheduleTemplateSets}
                  selectedTemplateId={selectedRunScheduleTemplateId}
                  onScheduleItemsChange={(scheduleItems) => updateScheduleItems(selectedLive.id, scheduleItems)}
                  onSelectedTemplateChange={setSelectedRunScheduleTemplateId}
                  onTemplateSave={saveRunScheduleTemplate}
                />
              </aside>
            )}
          </section>
        </section>
        )}
      </main>
    </div>
  );
}

function SetupScreen() {
  return (
    <section className="setupScreen">
      <div className="setupCard">
        <span>Setup required</span>
        <h1>Supabaseの接続情報が未設定です</h1>
        <p>
          実運用では追加・削除・編集した内容をDBへ保存します。
          `.env` に以下を設定してから起動してください。
        </p>
        <pre>{`VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_AUTH_ENABLED=true
VITE_AUTH_REDIRECT_URL=http://127.0.0.1:5173/idle-task-manager/`}</pre>
        <p>
          先にSupabaseのSQL Editorで `supabase/schema.sql` を実行し、
          AuthenticationのRedirect URLsに `VITE_AUTH_REDIRECT_URL` と同じURLを登録してください。
        </p>
      </div>
    </section>
  );
}

function AuthScreen({
  email,
  message,
  password,
  view,
  onEmailChange,
  onPasswordChange,
  onRequestPasswordReset,
  onSignIn,
  onSignUp,
  onViewChange,
}: {
  email: string;
  message: string;
  password: string;
  view: "signin" | "signup" | "reset";
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRequestPasswordReset: (event: FormEvent<HTMLFormElement>) => void;
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
  onSignUp: (event: FormEvent<HTMLFormElement>) => void;
  onViewChange: (view: "signin" | "signup" | "reset") => void;
}) {
  const isSignup = view === "signup";
  const isReset = view === "reset";
  const title = isSignup ? "新規登録" : isReset ? "パスワード再設定" : "ログイン";

  return (
    <section className="setupScreen">
      <form className="setupCard authCard" onSubmit={isSignup ? onSignUp : isReset ? onRequestPasswordReset : onSignIn}>
        <span>Live task manager</span>
        <h1>{title}</h1>
        {isSignup && (
          <p>
            メールアドレスを登録すると確認メールが届きます。パスワード設定後、管理者が権限を付与すると利用できます。
          </p>
        )}
        {isReset && <p>登録済みメールアドレスへ、パスワード再設定用のリンクを送信します。</p>}
        <label>
          <span>メールアドレス</span>
          <input
            autoComplete="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            type="email"
            required
          />
        </label>
        {!isSignup && !isReset && (
          <label>
            <span>パスワード</span>
            <input
              autoComplete="current-password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              type="password"
              required
            />
          </label>
        )}
        {message && <p className="authError">{message}</p>}
        <button className="primaryButton full" type="submit">
          {isSignup ? "確認メールを送信" : isReset ? "再設定メールを送信" : "ログイン"}
        </button>
        <div className="authLinks">
          {view !== "signin" && (
            <button onClick={() => onViewChange("signin")} type="button">
              ログインへ戻る
            </button>
          )}
          {view !== "signup" && (
            <button onClick={() => onViewChange("signup")} type="button">
              新規登録
            </button>
          )}
          {view !== "reset" && (
            <button onClick={() => onViewChange("reset")} type="button">
              パスワードを忘れた
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function PasswordSetupScreen({
  confirmPassword,
  isSubmitting,
  message,
  password,
  recoveryMode,
  onConfirmPasswordChange,
  onPasswordChange,
  onSubmit,
}: {
  confirmPassword: string;
  isSubmitting: boolean;
  message: string;
  password: string;
  recoveryMode: boolean;
  onConfirmPasswordChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="setupScreen">
      <form className="setupCard authCard" onSubmit={onSubmit}>
        <span>{recoveryMode ? "Password reset" : "Password setup"}</span>
        <h1>{recoveryMode ? "新しいパスワードを設定" : "パスワードを設定"}</h1>
        <p>次回以降はメールアドレスとこのパスワードでログインできます。</p>
        <label>
          <span>新しいパスワード</span>
          <input
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            type="password"
            required
          />
        </label>
        <label>
          <span>確認用パスワード</span>
          <input
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            type="password"
            required
          />
        </label>
        {message && <p className="authError">{message}</p>}
        <button className="primaryButton full" disabled={isSubmitting} type="submit">
          {isSubmitting ? "設定中" : "設定する"}
        </button>
      </form>
    </section>
  );
}

function AccessStatusScreen({
  email,
  message,
  status,
  onSignOut,
}: {
  email: string;
  message?: string;
  status: AppUserStatus | "error";
  onSignOut: () => void;
}) {
  const title =
    status === "active"
      ? "利用できます"
      : status === "suspended"
        ? "利用停止中です"
        : status === "error"
          ? "権限確認に失敗しました"
          : "承認待ちです";
  const body =
    status === "suspended"
      ? "このアカウントは現在利用停止中です。管理者に確認してください。"
      : status === "error"
        ? message || "ユーザー権限を確認できませんでした。"
        : "管理者がユーザー管理画面でロールと利用状態を設定すると、アプリを利用できます。";

  return (
    <section className="setupScreen">
      <div className="setupCard authCard">
        <span>Account status</span>
        <h1>{title}</h1>
        <p>{body}</p>
        {email && (
          <div className="accountEmail">
            <span>ログイン中</span>
            <strong>{email}</strong>
          </div>
        )}
        <button className="secondaryButton full" onClick={onSignOut} type="button">
          ログアウト
        </button>
      </div>
    </section>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <section className="setupScreen">
      <div className="setupCard">
        <span>Loading</span>
        <h1>{message}</h1>
      </div>
    </section>
  );
}

function ManagerView({
  groups,
  currentUserId,
  isAdmin,
  managerSection,
  managerContactFilter,
  managerGroupFilter,
  managerRoleFilter,
  projects,
  selectedManagerIssueId,
  selectedManagerLiveId,
  setManagerContactFilter,
  setManagerGroupFilter,
  setManagerRoleFilter,
  setManagerSection,
  setSelectedManagerIssueId,
  setSelectedManagerLiveId,
  lineTestSendingUserId,
  userManagementMessage,
  userProfiles,
  onOpenIssue,
  onLineTestSend,
  onUserProfileDelete,
  onUserProfileChange,
}: {
  groups: GroupPage[];
  currentUserId: string;
  isAdmin: boolean;
  managerSection: "status" | "users";
  managerContactFilter: string;
  managerGroupFilter: string;
  managerRoleFilter: TaskRoleFilter;
  projects: LiveProject[];
  selectedManagerIssueId: string;
  selectedManagerLiveId: string;
  setManagerContactFilter: (value: string | ((current: string) => string)) => void;
  setManagerGroupFilter: (value: string) => void;
  setManagerRoleFilter: (value: TaskRoleFilter) => void;
  setManagerSection: (value: "status" | "users") => void;
  setSelectedManagerIssueId: (value: string | ((current: string) => string)) => void;
  setSelectedManagerLiveId: (value: string) => void;
  lineTestSendingUserId: string;
  userManagementMessage: string;
  userProfiles: AppUserProfile[];
  onOpenIssue: (issue: ManagerIssue) => void;
  onLineTestSend: (userId: string) => void;
  onUserProfileDelete: (userId: string) => void;
  onUserProfileChange: (userId: string, updates: Pick<AppUserProfile, "role" | "status">) => void;
}) {
  const issues = useMemo(() => createManagerIssues(projects), [projects]);
  const activeProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.status !== "完了" &&
          (managerGroupFilter === "全グループ" || project.group === managerGroupFilter),
      ),
    [managerGroupFilter, projects],
  );
  const liveSummaries = useMemo(
    () =>
      activeProjects
        .map((project) => {
          const projectIssues = issues.filter((issue) => issue.liveId === project.id);
          const late = projectIssues.filter((issue) => issue.tags.includes("遅延")).length;
          const todayCount = projectIssues.filter((issue) => issue.tags.includes("今日")).length;
          const soon = projectIssues.filter((issue) => issue.tags.includes("3日以内")).length;
          const confirm = projectIssues.filter((issue) => issue.tags.includes("確認待ち")).length;
          const external = projectIssues.filter((issue) => issue.tags.includes("外注")).length;
          const unrequested = projectIssues.filter((issue) => issue.tags.includes("未依頼")).length;
          const requiredOpen = project.tasks.filter(
            (task) => task.priority === "必須" && task.status !== "完了",
          ).length;
          const score = late * 5 + todayCount * 4 + soon * 2 + confirm * 2 + unrequested * 2 + external + requiredOpen * 2;
          const risk: ManagerRisk =
            late > 0 || requiredOpen >= 3
              ? "high"
              : todayCount > 0 || soon > 0 || confirm > 0 || unrequested > 0 || external > 0 || requiredOpen > 0
                ? "warn"
                : "ok";
          const contacts = contactBreakdown(projectIssues, project.manager);
          return {
            project,
            issues: projectIssues,
            late,
            today: todayCount,
            soon,
            confirm,
            external,
            unrequested,
            requiredOpen,
            contacts,
            score,
            risk,
          };
        })
        .sort((a, b) => b.score - a.score || daysUntil(a.project.eventDate) - daysUntil(b.project.eventDate)),
    [activeProjects, issues],
  );
  const selectedLive = liveSummaries.find((item) => item.project.id === selectedManagerLiveId) ?? liveSummaries[0];
  const contactFilteredSelectedIssues =
    selectedLive && managerContactFilter !== "全員"
      ? selectedLive.issues.filter((issue) => issue.owner === managerContactFilter)
      : selectedLive?.issues ?? [];
  const filteredSelectedIssues =
    managerRoleFilter === "全ロール"
      ? contactFilteredSelectedIssues
      : contactFilteredSelectedIssues.filter((issue) => getManagerIssueRole(issue, selectedLive?.project) === managerRoleFilter);
  const managerRoleOptions = taskRoleFilters.filter((role) =>
    role === "全ロール" ? true : contactFilteredSelectedIssues.some((issue) => getManagerIssueRole(issue, selectedLive?.project) === role),
  );
  const issueSections = [
    {
      key: "task",
      title: "タスク",
      issues: filteredSelectedIssues.filter((issue) => managerIssueType(issue) === "task"),
    },
    {
      key: "production",
      title: "制作物",
      issues: filteredSelectedIssues.filter((issue) => managerIssueType(issue) === "production"),
    },
    {
      key: "ticket",
      title: "チケット",
      issues: filteredSelectedIssues.filter((issue) => managerIssueType(issue) === "ticket"),
    },
  ].filter((section) => section.issues.length > 0);
  const selectedManagerIssue = filteredSelectedIssues.find((issue) => issue.id === selectedManagerIssueId);
  const summaryCounts = {
    high: liveSummaries.filter((item) => item.risk === "high").length,
    warn: liveSummaries.filter((item) => item.risk === "warn").length,
    ok: liveSummaries.filter((item) => item.risk === "ok").length,
  };
  const groupedSummaries = groups
    .map((group) => ({
      group,
      items: liveSummaries.filter((item) => item.project.group === group.name),
    }))
    .filter((section) => section.items.length > 0);
  const managerStates: Array<{ risk: ManagerRisk; className: string; label: string; count: number }> = [
    { risk: "high", className: "high", label: "要介入", count: summaryCounts.high },
    { risk: "warn", className: "warn", label: "注意", count: summaryCounts.warn },
    { risk: "ok", className: "ok", label: "順調", count: summaryCounts.ok },
  ];
  const getPrimaryReason = (item: (typeof liveSummaries)[number]) => {
    if (item.late > 0) return `${item.late}件の遅延が止まっています`;
    if (item.requiredOpen > 0) return `${item.requiredOpen}件の必須タスクが未完です`;
    if (item.today + item.soon > 0) return `${item.today + item.soon}件が3日以内に締切です`;
    if (item.unrequested > 0) return `${item.unrequested}件の制作物が未依頼です`;
    if (item.confirm > 0) return `${item.confirm}件が確認待ちです`;
    if (item.external > 0) return `${item.external}件が外注先で進行中です`;
    return "現時点で目立つ停止要因はありません";
  };

  useEffect(() => {
    if (!liveSummaries.length) {
      setSelectedManagerLiveId("");
      return;
    }
    if (!liveSummaries.some((item) => item.project.id === selectedManagerLiveId)) {
      setSelectedManagerLiveId(liveSummaries[0].project.id);
    }
    if (managerContactFilter !== "全員" && !liveSummaries.find((item) => item.project.id === selectedManagerLiveId)?.contacts.some((contact) => contact.owner === managerContactFilter)) {
      setManagerContactFilter("全員");
    }
    if (managerRoleFilter !== "全ロール" && !managerRoleOptions.includes(managerRoleFilter)) {
      setManagerRoleFilter("全ロール");
    }
    if (selectedManagerIssueId && !filteredSelectedIssues.some((issue) => issue.id === selectedManagerIssueId)) {
      setSelectedManagerIssueId("");
    }
  }, [filteredSelectedIssues, liveSummaries, managerContactFilter, managerRoleFilter, managerRoleOptions, selectedManagerIssueId, selectedManagerLiveId]);

  return (
    <section className="managerView liveManagerView">
      {isAdmin && (
        <div className="managerModeTabs">
          <button
            className={managerSection === "status" ? "active" : ""}
            onClick={() => setManagerSection("status")}
            type="button"
          >
            ライブ状況
          </button>
          <button
            className={managerSection === "users" ? "active" : ""}
            onClick={() => setManagerSection("users")}
            type="button"
          >
            ユーザー管理
          </button>
        </div>
      )}
      {isAdmin && managerSection === "users" ? (
        <UserManagementView
          currentUserId={currentUserId}
          lineTestSendingUserId={lineTestSendingUserId}
          message={userManagementMessage}
          profiles={userProfiles}
          onLineTestSend={onLineTestSend}
          onUserProfileDelete={onUserProfileDelete}
          onUserProfileChange={onUserProfileChange}
        />
      ) : (
      <div className="liveManagerGrid">
        <section className="managerPanel liveBoardPanel">
          <div className="managerPanelHead managerBoardHead">
            <div className="managerBoardTitleRow">
              <h3>ライブ別状況</h3>
              <label className="managerGroupFilter">
                <select
                  value={managerGroupFilter}
                  onChange={(event) => {
                    setManagerGroupFilter(event.target.value);
                    setManagerContactFilter("全員");
                    setManagerRoleFilter("全ロール");
                    setSelectedManagerIssueId("");
                  }}
                >
                  <option>全グループ</option>
                  {groups.map((group) => (
                    <option key={group.name}>{group.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="liveManagerSummary">
              {managerStates.map((state) => (
                <div className={`riskSummary ${state.className}`} key={state.risk}>
                  <b>{state.count}</b>
                  <small>{state.label}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="managerLiveList groupedManagerLiveList">
            {groupedSummaries.map((section) => (
              <div className="managerGroupBlock" key={section.group.name}>
                <div className="managerGroupHead">
                  <strong>{section.group.name}</strong>
                  <span>{section.items.length}ライブ</span>
                </div>
                {section.items.map((item) => (
                  <button
                    className={`managerLiveCard risk-${item.risk} ${selectedLive?.project.id === item.project.id ? "selected" : ""}`}
                    key={item.project.id}
                    onClick={() => {
                      setSelectedManagerLiveId(item.project.id);
                      setManagerContactFilter("全員");
                      setManagerRoleFilter("全ロール");
                      setSelectedManagerIssueId("");
                    }}
                    type="button"
                  >
                    <div className="managerLiveTitle">
                      <div>
                        <span>{formatDate(item.project.eventDate)} @{item.project.venue}</span>
                        <strong>{item.project.title}</strong>
                      </div>
                      <em>{riskLabel(item.risk)}</em>
                    </div>
                    <p className="managerLiveReason">{getPrimaryReason(item)}</p>
                    {item.contacts.length > 0 && (
                      <div className="managerContactLine">
                        <span>連絡</span>
                        {item.contacts.slice(0, 3).map((contact) => (
                          <strong key={contact.owner}>{contact.owner}</strong>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ))}
            {liveSummaries.length === 0 && <div className="managerEmpty">表示するライブはありません</div>}
          </div>
        </section>

        <section className="managerPanel liveDetailPanel">
          <div className="managerPanelHead">
            <h3>{selectedLive ? `${formatDate(selectedLive.project.eventDate)} ${selectedLive.project.title}` : "ライブ詳細"}</h3>
            {selectedLive && <span>{riskLabel(selectedLive.risk)}</span>}
          </div>
          {selectedLive ? (
            <>
              <div className={`selectedLiveStatus risk-${selectedLive.risk}`}>
                <div>
                  <span>{selectedLive.project.group} @{selectedLive.project.venue}</span>
                  <strong>{getPrimaryReason(selectedLive)}</strong>
                </div>
                <button
                  onClick={() =>
                    onOpenIssue({
                      id: `${selectedLive.project.id}-open`,
                      kind: selectedLive.risk === "high" ? "遅延" : "今日",
                      tags: ["全て"],
                      group: selectedLive.project.group,
                      liveId: selectedLive.project.id,
                      liveTitle: selectedLive.project.title,
                      owner: selectedLive.project.manager,
                      title: selectedLive.project.title,
                      detail: "ライブ詳細を確認",
                      priority: 0,
                    })
                  }
                  type="button"
                >
                  作業画面で開く
                </button>
              </div>

              <div className="managerContactPanel">
                {selectedLive.contacts.length > 0 ? (
                  <div className="managerContactChips">
                    <button
                      className={managerContactFilter === "全員" ? "active" : ""}
                      onClick={() => setManagerContactFilter("全員")}
                      type="button"
                    >
                      全員
                      <small>{selectedLive.issues.length}件</small>
                    </button>
                    {selectedLive.contacts.map((contact) => (
                      <button
                        className={managerContactFilter === contact.owner ? "active" : ""}
                        key={contact.owner}
                        onClick={() =>
                          setManagerContactFilter((current) => (current === contact.owner ? "全員" : contact.owner))
                        }
                        title={contact.reason}
                        type="button"
                      >
                        {contact.owner}
                        <small>{contact.count}件</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="managerNoContact">連絡不要</div>
                )}
                <div className="managerRoleChips">
                  {managerRoleOptions.map((role) => (
                    <button
                      className={managerRoleFilter === role ? "active" : ""}
                      key={role}
                      onClick={() => {
                        setManagerRoleFilter(role);
                        setSelectedManagerIssueId("");
                      }}
                      type="button"
                    >
                      {role}
                      <small>
                        {role === "全ロール"
                          ? contactFilteredSelectedIssues.length
                          : contactFilteredSelectedIssues.filter((issue) => getManagerIssueRole(issue, selectedLive.project) === role).length}
                        件
                      </small>
                    </button>
                  ))}
                </div>
              </div>


              <div className="selectedLiveIssueHead">
                <h4>止まっている原因</h4>
                <span>{filteredSelectedIssues.length}件</span>
              </div>
              <div className="selectedLiveIssues">
                {issueSections.map((section) => (
                  <div className="selectedLiveIssueSection" key={section.key}>
                    <div className="selectedLiveIssueSectionHead">
                      <div>
                        <strong>{section.title}</strong>
                      </div>
                      <span>{section.issues.length}件</span>
                    </div>
                    {section.issues.map((issue) => (
                      <div className="selectedLiveIssueEntry" key={issue.id}>
                        <button
                          className={`selectedLiveIssue risk-${issueRisk(issue)} ${selectedManagerIssueId === issue.id ? "active" : ""}`}
                          onClick={() =>
                            setSelectedManagerIssueId((current) => (current === issue.id ? "" : issue.id))
                          }
                          type="button"
                        >
                          <StatusPill value={issue.kind} />
                          <div>
                            <strong>{issue.title}</strong>
                            <span>
                              連絡: {issue.owner}
                              {issue.date ? ` / 期日 ${formatDate(issue.date)}` : ""}
                              {issue.detail ? ` / ${issue.detail}` : ""}
                            </span>
                          </div>
                        </button>
                        {selectedManagerIssue?.id === issue.id && (
                          <ManagerIssueEditor
                            issue={issue}
                            project={selectedLive.project}
                            onOpenIssue={onOpenIssue}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                {issueSections.length === 0 && (
                  <div className="managerEmpty">該当する停止原因はありません</div>
                )}
              </div>
            </>
          ) : (
            <div className="managerEmpty">ライブを選択してください</div>
          )}
        </section>
      </div>
      )}
    </section>
  );
}

function UserManagementView({
  currentUserId,
  lineTestSendingUserId,
  message,
  profiles,
  onLineTestSend,
  onUserProfileDelete,
  onUserProfileChange,
}: {
  currentUserId: string;
  lineTestSendingUserId: string;
  message: string;
  profiles: AppUserProfile[];
  onLineTestSend: (userId: string) => void;
  onUserProfileDelete: (userId: string) => void;
  onUserProfileChange: (userId: string, updates: Pick<AppUserProfile, "role" | "status">) => void;
}) {
  const pendingCount = profiles.filter((profile) => profile.status === "pending").length;
  const activeCount = profiles.filter((profile) => profile.status === "active").length;
  const chekiCount = profiles.filter((profile) => profile.status === "active" && profile.role === "cheki").length;

  return (
    <section className="managerPanel userAdminPanel">
      <div className="managerPanelHead userAdminHead">
        <div>
          <h3>ユーザー管理</h3>
          <span>登録済みユーザーの利用状態とロールを管理します</span>
        </div>
      </div>

      <div className="userAdminSummary">
        <div>
          <b>{pendingCount}</b>
          <span>承認待ち</span>
        </div>
        <div>
          <b>{activeCount}</b>
          <span>利用中</span>
        </div>
        <div>
          <b>{chekiCount}</b>
          <span>チェキスタッフ</span>
        </div>
      </div>

      {message && <p className="userAdminMessage">{message}</p>}

      <div className="userAdminList">
        {profiles.map((profile) => {
          const isSelf = profile.id === currentUserId;
          const isLineLinked = Boolean(profile.lineLinkedAt);
          const isLineSending = lineTestSendingUserId === profile.id;
          return (
            <article className={`userAdminRow status-${profile.status}`} key={profile.id}>
              <div className="userAdminIdentity">
                <strong>{profile.email || "メール未設定"}</strong>
                <span>
                  {profile.displayName || "名前未設定"} / {formatDate(profile.createdAt)}
                </span>
              </div>
              <label>
                <span>ロール</span>
                <select
                  disabled={isSelf}
                  value={profile.role}
                  onChange={(event) =>
                    onUserProfileChange(profile.id, {
                      role: event.target.value as AppUserRole,
                      status: profile.status,
                    })
                  }
                >
                  <option value="admin">管理者</option>
                  <option value="employee">社員</option>
                  <option value="cheki">チェキスタッフ</option>
                </select>
              </label>
              <label>
                <span>状態</span>
                <select
                  disabled={isSelf}
                  value={profile.status}
                  onChange={(event) =>
                    onUserProfileChange(profile.id, {
                      role: profile.role,
                      status: event.target.value as AppUserStatus,
                    })
                  }
                >
                  <option value="pending">承認待ち</option>
                  <option value="active">有効</option>
                  <option value="suspended">停止</option>
                </select>
              </label>
              <div className="userAdminStatus">
                <StatusPill value={userStatusLabel(profile.status)} />
                {isSelf && <small>自分自身</small>}
              </div>
              <div className="userAdminLine">
                <span className={`lineLinkedBadge ${isLineLinked ? "linked" : ""}`}>
                  {isLineLinked ? "LINE連携済み" : "LINE未連携"}
                </span>
                <button
                  disabled={!isLineLinked || isLineSending}
                  onClick={() => onLineTestSend(profile.id)}
                  type="button"
                >
                  <Send size={14} />
                  {isLineSending ? "送信中" : "通知テスト"}
                </button>
              </div>
              <div className="userAdminActions">
                <button
                  aria-label="ユーザーを削除"
                  disabled={isSelf}
                  onClick={() => onUserProfileDelete(profile.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                  削除
                </button>
              </div>
            </article>
          );
        })}
        {profiles.length === 0 && <div className="managerEmpty">ユーザーはまだ登録されていません</div>}
      </div>
    </section>
  );
}

function ChekiStaffView({
  appliedShiftIds,
  chekiRecruitments,
  groups,
  onAppliedShiftIdsChange,
  projects,
}: {
  appliedShiftIds: string[];
  chekiRecruitments: ChekiRecruitmentRecord[];
  groups: GroupPage[];
  onAppliedShiftIdsChange: (value: string[] | ((current: string[]) => string[])) => void;
  projects: LiveProject[];
}) {
  const [groupFilter, setGroupFilter] = useState("全グループ");
  const [statusFilter, setStatusFilter] = useState<"募集中" | "応募済み" | "確定" | "全て">("募集中");
  const [pendingChekiAction, setPendingChekiAction] = useState<{
    type: "apply" | "cancel";
    shift: ChekiShift;
  } | null>(null);
  const shifts = useMemo(
    () => (chekiRecruitments.length > 0 ? chekiRecruitments.map(mapChekiRecruitmentToShift) : createChekiShifts(projects)),
    [chekiRecruitments, projects],
  );
  const shiftsWithApplication = shifts.map((shift) => ({
    ...shift,
    status: appliedShiftIds.includes(shift.id) && shift.status === "募集中" ? "応募済み" as const : shift.status,
  }));
  const groupFilteredShifts = shiftsWithApplication.filter(
    (shift) => groupFilter === "全グループ" || shift.group === groupFilter,
  );
  const sortedGroupShifts = [...groupFilteredShifts].sort((a, b) =>
    `${a.date}${a.timeRange}${a.liveTitle}`.localeCompare(`${b.date}${b.timeRange}${b.liveTitle}`),
  );
  const chekiDateStatuses = useMemo(
    () =>
      groupFilteredShifts.reduce<Record<string, ChekiCalendarDateStatus>>((statuses, shift) => {
        if (shift.status === "募集中") {
          statuses[shift.date] = "available";
        } else if (!statuses[shift.date]) {
          statuses[shift.date] = "full";
        }
        return statuses;
      }, {}),
    [groupFilteredShifts],
  );
  const visibleShifts = groupFilteredShifts
    .map((shift) => ({
      ...shift,
      status: appliedShiftIds.includes(shift.id) && shift.status === "募集中" ? "応募済み" as const : shift.status,
    }))
    .filter((shift) => statusFilter === "全て" || shift.status === statusFilter)
    .sort((a, b) => `${a.date}${a.timeRange}${a.liveTitle}`.localeCompare(`${b.date}${b.timeRange}${b.liveTitle}`));
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [selectedChekiDate, setSelectedChekiDate] = useState("");
  const selectedShift =
    sortedGroupShifts.find((shift) => shift.id === selectedShiftId) ?? visibleShifts[0] ?? sortedGroupShifts[0];
  const activeChekiDate = selectedChekiDate || selectedShift?.date || toIsoDate(today);
  const selectedDateShifts = sortedGroupShifts.filter((shift) => shift.date === activeChekiDate);
  const detailShifts = selectedDateShifts.length > 0 ? selectedDateShifts : selectedShift ? [selectedShift] : [];
  const ownShifts = shiftsWithApplication
    .filter((shift) => shift.status === "確定" || appliedShiftIds.includes(shift.id))
    .sort((a, b) => `${a.date}${a.timeRange}${a.liveTitle}`.localeCompare(`${b.date}${b.timeRange}${b.liveTitle}`));
  const [selectedOwnShiftId, setSelectedOwnShiftId] = useState("");
  const selectedOwnShift = ownShifts.find((shift) => shift.id === selectedOwnShiftId) ?? ownShifts[0];
  const availableCount = shiftsWithApplication.filter((shift) => shift.status === "募集中").length;
  const appliedCount = shiftsWithApplication.filter((shift) => shift.status === "応募済み").length;
  const confirmedCount = shiftsWithApplication.filter((shift) => shift.status === "確定").length;

  useEffect(() => {
    if (!sortedGroupShifts.length) {
      setSelectedShiftId("");
      setSelectedChekiDate("");
      return;
    }
    if (selectedChekiDate && !sortedGroupShifts.some((shift) => shift.date === selectedChekiDate)) {
      const nextShift = visibleShifts[0] ?? sortedGroupShifts[0];
      setSelectedChekiDate(nextShift.date);
      setSelectedShiftId(nextShift.id);
      return;
    }
    if (!sortedGroupShifts.some((shift) => shift.id === selectedShiftId)) {
      const nextShift =
        sortedGroupShifts.find((shift) => shift.date === selectedChekiDate) ?? visibleShifts[0] ?? sortedGroupShifts[0];
      setSelectedShiftId(nextShift.id);
      if (!selectedChekiDate) {
        setSelectedChekiDate(nextShift.date);
      }
    } else if (!selectedChekiDate) {
      setSelectedChekiDate(selectedShift?.date ?? sortedGroupShifts[0].date);
    }
  }, [selectedChekiDate, selectedShift?.date, selectedShiftId, sortedGroupShifts, visibleShifts]);

  useEffect(() => {
    if (!ownShifts.length) {
      setSelectedOwnShiftId("");
      return;
    }
    if (!ownShifts.some((shift) => shift.id === selectedOwnShiftId)) {
      setSelectedOwnShiftId(ownShifts[0].id);
    }
  }, [ownShifts, selectedOwnShiftId]);

  const applyShift = (shiftId: string) => {
    const targetShift = shiftsWithApplication.find((shift) => shift.id === shiftId);
    if (!targetShift) return;
    onAppliedShiftIdsChange((current) => {
      if (current.includes(shiftId)) return current;
      const hasSameDayApplication = shiftsWithApplication.some(
        (shift) => shift.date === targetShift.date && current.includes(shift.id),
      );
      return hasSameDayApplication ? current : [...current, shiftId];
    });
  };

  const cancelShift = (shiftId: string) => {
    onAppliedShiftIdsChange((current) => current.filter((id) => id !== shiftId));
  };

  const confirmChekiAction = () => {
    if (!pendingChekiAction) return;
    if (pendingChekiAction.type === "apply") {
      applyShift(pendingChekiAction.shift.id);
    } else {
      cancelShift(pendingChekiAction.shift.id);
    }
    setPendingChekiAction(null);
  };

  const renderChekiShiftDetail = (shift: ChekiShift) => {
    const isApplied = appliedShiftIds.includes(shift.id);
    const hasOtherSameDayApplication = shiftsWithApplication.some(
      (current) => current.date === shift.date && current.id !== shift.id && appliedShiftIds.includes(current.id),
    );
    const cannotApply = shift.status !== "募集中" || hasOtherSameDayApplication;
    return (
      <article
        className={`chekiDetailCard ${selectedShift?.id === shift.id ? "selected" : ""}`}
        key={shift.id}
        onClick={() => setSelectedShiftId(shift.id)}
      >
        <div className="chekiDetailHead">
          <div>
            <span>{shift.group}</span>
            <h3>{shift.liveTitle}</h3>
          </div>
          <StatusPill value={shift.status} />
        </div>

        <div className="chekiInfoGrid compact">
          <span>
            <CalendarDays size={15} />
            日程 <strong>{formatDate(shift.date)}</strong>
          </span>
          <span>
            <Clock3 size={15} />
            時間 <strong>{shift.timeRange}</strong>
          </span>
          <span>
            <UserRound size={15} />
            募集 <strong>{shift.assignedCount}/{shift.requiredCount}名</strong>
          </span>
          <span>
            <Sparkles size={15} />
            場所 <strong>{shift.venue}</strong>
          </span>
          <span className="cancelRule">
            <CircleAlert size={15} />
            キャンセル <strong>{shift.cancelUntil}まで</strong>
          </span>
        </div>

        <div className="chekiDetailBox">
          <strong>担当内容</strong>
          <p>{shift.role}</p>
        </div>
        <div className="chekiDetailBox">
          <strong>メモ</strong>
          <p>{shift.memo}</p>
        </div>

        {isApplied ? (
          <button
            className="chekiCancelButton"
            onClick={() => setPendingChekiAction({ type: "cancel", shift })}
            type="button"
          >
            <X size={16} />
            応募をキャンセル
          </button>
        ) : (
          <button
            className="chekiApplyButton"
            disabled={cannotApply}
            onClick={() => setPendingChekiAction({ type: "apply", shift })}
            type="button"
          >
            {cannotApply ? <Check size={16} /> : <Send size={16} />}
            {hasOtherSameDayApplication
              ? "同日に応募済み"
              : shift.status === "募集中"
                ? "この枠に応募する"
                : `${shift.status}です`}
          </button>
        )}
      </article>
    );
  };

  return (
    <section className="chekiView">
      <section className="chekiHero">
        <div>
          <span>Cheki staff portal</span>
          <h2>チェキスタッフ募集</h2>
          <p>募集中のライブを確認し、参加できる枠へ応募できます。応募状態はログインユーザーごとに保存されます。</p>
        </div>
        <div className="chekiStats">
          <div>
            <b>{availableCount}</b>
            <span>募集中</span>
          </div>
          <div>
            <b>{appliedCount}</b>
            <span>応募済み</span>
          </div>
          <div>
            <b>{confirmedCount}</b>
            <span>確定</span>
          </div>
        </div>
      </section>

      <div className="chekiGrid">
        <section className="chekiPanel chekiBoard">
          <ChekiLiveCalendar
            dateStatuses={chekiDateStatuses}
            selectedDate={activeChekiDate}
            onSelectDate={(date) => {
              const nextShift = visibleShifts.find((shift) => shift.date === date)
                ?? groupFilteredShifts.find((shift) => shift.date === date);
              if (!nextShift) return;
              if (statusFilter !== "全て" && nextShift.status !== statusFilter) {
                setStatusFilter("全て");
              }
              setSelectedChekiDate(date);
              setSelectedShiftId(nextShift.id);
            }}
          />
          <div className="chekiFilters">
            <label>
              <span>グループ</span>
              <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                <option>全グループ</option>
                {groups.map((group) => (
                  <option key={group.name}>{group.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>状態</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              >
                <option>募集中</option>
                <option>応募済み</option>
                <option>確定</option>
                <option>全て</option>
              </select>
            </label>
          </div>

          <div className="chekiShiftList">
            {visibleShifts.map((shift) => (
              <button
                className={`chekiShiftCard ${selectedShift?.id === shift.id ? "selected" : ""}`}
                key={shift.id}
                onClick={() => {
                  setSelectedChekiDate(shift.date);
                  setSelectedShiftId(shift.id);
                }}
                type="button"
              >
                <div className="chekiShiftTitle">
                  <div>
                    <span>{formatDate(shift.date)} / {shift.timeRange}</span>
                    <strong>{shift.liveTitle}</strong>
                  </div>
                  <StatusPill value={shift.status} />
                </div>
                <div className="chekiShiftMeta">
                  <span>{shift.group}</span>
                  <span>@{shift.venue}</span>
                  <span>{shift.assignedCount}/{shift.requiredCount}名</span>
                </div>
              </button>
            ))}
            {visibleShifts.length === 0 && <div className="managerEmpty">表示する募集枠はありません</div>}
          </div>
        </section>

        <section className="chekiPanel chekiDetail">
          {detailShifts.length > 0 ? (
            <>
              <div className="chekiDayHead">
                <div>
                  <span>選択日</span>
                  <h3>{formatDate(activeChekiDate)}</h3>
                </div>
                <span>{detailShifts.length}件</span>
              </div>

              <div className="chekiDetailList">
                {detailShifts.map((shift) => renderChekiShiftDetail(shift))}
              </div>

              <div className="chekiNextNote">
                <strong>応募後の流れ</strong>
                <span>担当者が応募状況を確認し、確定後に集合時間や詳細を共有します。</span>
              </div>
            </>
          ) : (
            <div className="managerEmpty">募集枠を選択してください</div>
          )}
        </section>

        <section className="chekiPanel chekiSchedule">
          <div className="chekiPanelHead">
            <h3>自分の予定</h3>
            <span>応募・確定</span>
          </div>
          <div className="chekiConfirmedList">
            {ownShifts.slice(0, 6).map((shift) => (
                <button
                  className={`chekiConfirmedItem ${selectedOwnShift?.id === shift.id ? "selected" : ""}`}
                  key={shift.id}
                  onClick={() => setSelectedOwnShiftId(shift.id)}
                  type="button"
                >
                  <StatusPill value={appliedShiftIds.includes(shift.id) ? "応募済み" : shift.status} />
                  <div>
                    <strong>{formatDate(shift.date)} {shift.timeRange}</strong>
                    <span>{shift.liveTitle}</span>
                  </div>
                </button>
              ))}
            {ownShifts.length === 0 && (
              <div className="managerEmpty">応募・確定済みの予定はありません</div>
            )}
          </div>
          {selectedOwnShift && (
            <div className="chekiOwnDetail">
              <strong>{selectedOwnShift.liveTitle}</strong>
              <span>場所: {selectedOwnShift.venue}</span>
              <span>集合時間: {selectedOwnShift.meetingTime}</span>
              <span>集合場所: {selectedOwnShift.meetingPlace}</span>
              <span>持ち物: {selectedOwnShift.belongings}</span>
              {appliedShiftIds.includes(selectedOwnShift.id) && (
                <button
                  className="chekiOwnCancelButton"
                  onClick={() => setPendingChekiAction({ type: "cancel", shift: selectedOwnShift })}
                  type="button"
                >
                  応募をキャンセル
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      {pendingChekiAction && (
        <div className="chekiConfirmOverlay" role="dialog" aria-modal="true">
          <div className="chekiConfirmDialog">
            <span>{pendingChekiAction.type === "apply" ? "応募確認" : "キャンセル確認"}</span>
            <h3>{pendingChekiAction.shift.liveTitle}</h3>
            <p>
              {formatDate(pendingChekiAction.shift.date)} {pendingChekiAction.shift.timeRange} / @
              {pendingChekiAction.shift.venue}
            </p>
            <strong>
              {pendingChekiAction.type === "apply"
                ? "この募集枠に応募しますか？"
                : "この応募をキャンセルしますか？"}
            </strong>
            <div>
              <button className="secondary" onClick={() => setPendingChekiAction(null)} type="button">
                戻る
              </button>
              <button
                className={pendingChekiAction.type === "cancel" ? "danger" : ""}
                onClick={confirmChekiAction}
                type="button"
              >
                {pendingChekiAction.type === "apply" ? "応募する" : "キャンセルする"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function createChekiShifts(projects: LiveProject[]): ChekiShift[] {
  return projects
    .filter((project) => project.status !== "完了" && daysUntil(project.eventDate) >= 0)
    .sort((a, b) => `${a.eventDate}${a.title}`.localeCompare(`${b.eventDate}${b.title}`))
    .slice(0, 14)
    .map((project, index) => {
      const requiredCount = project.liveType === "ワンマン" ? 6 : project.liveType === "生誕祭" ? 5 : 3;
      const assignedCount = 0;
      return {
        id: `cheki-${project.id}`,
        liveId: project.id,
        group: project.group,
        liveTitle: project.title,
        venue: project.venue,
        date: project.eventDate,
        timeRange: project.liveType === "ワンマン" ? "16:30-21:30" : "18:00-21:30",
        role: "チェキ列整理、撮影補助、販売導線の案内、終演後の物販撤収補助",
        requiredCount,
        assignedCount,
        status: "募集中",
        cancelUntil: formatDate(addDays(toDate(project.eventDate), -3)),
        meetingTime: project.liveType === "ワンマン" ? "16:00" : "17:30",
        meetingPlace: `${project.venue} 入口付近`,
        belongings: "黒系の服装、身分証、筆記用具、飲み物",
        memo: project.liveType === "生誕祭"
          ? "生誕導線があるため、開場前の集合時間を確認してください。"
          : "服装は黒系推奨。集合場所は確定後に共有します。",
      };
    });
}

function mapChekiRecruitmentToShift(recruitment: ChekiRecruitmentRecord): ChekiShift {
  return {
    id: recruitment.id,
    liveId: recruitment.liveId ?? recruitment.id,
    group: recruitment.group,
    liveTitle: recruitment.liveTitle,
    venue: recruitment.venue,
    date: recruitment.date,
    timeRange: recruitment.timeRange,
    role: recruitment.role,
    requiredCount: recruitment.requiredCount,
    assignedCount: recruitment.assignedCount,
    status: recruitment.status,
    cancelUntil: recruitment.cancelUntil ? formatDate(recruitment.cancelUntil) : "確定後に共有",
    meetingTime: recruitment.meetingTime,
    meetingPlace: recruitment.meetingPlace,
    belongings: recruitment.belongings,
    memo: recruitment.memo,
  };
}

function ChekiLiveCalendar({
  dateStatuses,
  selectedDate,
  onSelectDate,
}: {
  dateStatuses: Record<string, ChekiCalendarDateStatus>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(firstDayOfMonth(selectedDate));

  useEffect(() => {
    setVisibleMonth(firstDayOfMonth(selectedDate));
  }, [selectedDate]);

  const anchor = toDate(visibleMonth);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeksInGrid = Math.max(5, Math.ceil((startOffset + daysInMonth) / 7));
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells = Array.from({ length: weeksInGrid * 7 }, (_, index) => {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    const date = toIsoDate(cellDate);
    return {
      date,
      inMonth: cellDate.getFullYear() === year && cellDate.getMonth() === month,
      dayOfWeek: cellDate.getDay(),
      status: dateStatuses[date],
    };
  });

  const moveMonth = (offset: number) => {
    setVisibleMonth(toIsoDate(new Date(year, month + offset, 1)));
  };

  return (
    <div className="chekiLiveCalendar">
      <div className="chekiLiveCalendarHead">
        <div>
          <CalendarDays size={15} />
          <strong>ライブカレンダー</strong>
          <span>{year}/{month + 1}</span>
        </div>
        <div>
          <button aria-label="前月" onClick={() => moveMonth(-1)} type="button">
            <ChevronLeft size={14} />
          </button>
          <button aria-label="翌月" onClick={() => moveMonth(1)} type="button">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="chekiCalendarWeekdays">
        {["日", "月", "火", "水", "木", "金", "土"].map((day, index) => (
          <span className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""} key={day}>
            {day}
          </span>
        ))}
      </div>
      <div className="chekiCalendarGrid">
        {cells.map((cell) => (
          <button
            className={`${cell.inMonth ? "" : "otherMonth"} ${cell.status ? "hasLive" : ""} ${
              cell.status === "available" ? "available" : cell.status === "full" ? "full" : ""
            } ${
              cell.date === selectedDate ? "selected" : ""
            } ${cell.date === toIsoDate(today) ? "today" : ""} ${
              cell.dayOfWeek === 0 ? "sunday" : cell.dayOfWeek === 6 ? "saturday" : ""
            }`}
            disabled={!cell.status}
            key={cell.date}
            onClick={() => onSelectDate(cell.date)}
            type="button"
          >
            <span>{toDate(cell.date).getDate()}</span>
            {cell.status && <b>{cell.status === "available" ? "○" : "×"}</b>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ManagerIssueEditor({
  issue,
  project,
  onOpenIssue,
}: {
  issue: ManagerIssue;
  project: LiveProject;
  onOpenIssue: (issue: ManagerIssue) => void;
}) {
  const ticket = issue.ticketId ? project.tickets.find((current) => current.id === issue.ticketId) : undefined;
  const productionItem = issue.productionItemId
    ? project.productionItems.find((current) => current.id === issue.productionItemId)
    : undefined;
  const task = issue.taskId ? project.tasks.find((current) => current.id === issue.taskId) : undefined;

  if (ticket) {
    return (
      <div className="managerInlineEditor readonly">
        <div className="managerInlineEditorHead">
          <strong>チケット情報</strong>
        </div>
        <ReadOnlyRows
          rows={[
            ["価格", `${ticket.price.toLocaleString("ja-JP")}円`],
            ["状態", ticketStatus(ticket)],
            ["URL", ticket.pageUrl || "未入力"],
            ["特典", ticket.benefit || "未入力"],
          ]}
        />
        <button className="primaryButton full" onClick={() => onOpenIssue(issue)} type="button">
          作業画面で開く
        </button>
      </div>
    );
  }

  if (productionItem) {
    return (
      <div className="managerInlineEditor readonly">
        <div className="managerInlineEditorHead">
          <strong>制作物情報</strong>
        </div>
        <ReadOnlyRows
          rows={[
            ["担当", productionItem.owner],
            ["担当デザイナー", productionItem.designer || "未入力"],
            ["外注先", productionItem.vendor],
            ["状態", productionItem.status],
            ["URL", productionItem.fileUrl || "未入力"],
            ["メモ", productionItem.memo || "なし"],
          ]}
        />
        <button className="primaryButton full" onClick={() => onOpenIssue(issue)} type="button">
          作業画面で開く
        </button>
      </div>
    );
  }

  if (task) {
    return (
      <div className="managerInlineEditor readonly">
        <div className="managerInlineEditorHead">
          <strong>タスク情報</strong>
        </div>
        <ReadOnlyRows
          rows={[
            ["カテゴリ", task.phase],
            ["状態", task.status],
            ["重要度", task.priority],
            ["メモ", task.memo || "なし"],
          ]}
        />
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="readonlySubtasks">
            {task.subtasks.map((subtask) => (
              <span className={subtask.done ? "done" : ""} key={subtask.id}>
                {subtask.title}
              </span>
            ))}
          </div>
        )}
        <button className="primaryButton full" onClick={() => onOpenIssue(issue)} type="button">
          作業画面で開く
        </button>
      </div>
    );
  }

  return (
    <div className="managerInlineEditor readonly">
      <div className="managerInlineEditorHead">
        <strong>詳細を確認</strong>
        <span>{issue.title}</span>
      </div>
      <button className="primaryButton full" onClick={() => onOpenIssue(issue)} type="button">
        作業画面で開く
      </button>
    </div>
  );
}

function ReadOnlyRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="readonlyRows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
function riskLabel(risk: string) {
  if (risk === "high") return "要介入";
  if (risk === "warn") return "注意";
  return "順調";
}

function userStatusLabel(status: AppUserStatus) {
  if (status === "active") return "有効";
  if (status === "suspended") return "停止";
  return "承認待ち";
}

function contactBreakdown(issues: ManagerIssue[], fallback: string): ManagerContact[] {
  void fallback;
  if (issues.length === 0) return [];
  const contacts = new Map<string, { count: number; late: number; today: number; confirm: number; unrequested: number; external: number; score: number }>();
  issues.forEach((issue) => {
    const current = contacts.get(issue.owner) ?? { count: 0, late: 0, today: 0, confirm: 0, unrequested: 0, external: 0, score: 0 };
    const late = issue.tags.includes("遅延") ? 1 : 0;
    const todayIssue = issue.tags.includes("今日") ? 1 : 0;
    const confirm = issue.tags.includes("確認待ち") ? 1 : 0;
    const unrequested = issue.tags.includes("未依頼") ? 1 : 0;
    const external = issue.tags.includes("外注") ? 1 : 0;
    current.count += 1;
    current.late += late;
    current.today += todayIssue;
    current.confirm += confirm;
    current.unrequested += unrequested;
    current.external += external;
    current.score += late * 5 + todayIssue * 3 + confirm * 3 + unrequested * 2 + external + 1;
    contacts.set(issue.owner, current);
  });
  return [...contacts.entries()]
    .map(([owner, value]) => ({
      owner,
      count: value.count,
      reason: contactReasonFromCounts(value),
      score: value.score,
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 3);
}

function contactReasonFromCounts(value: { count: number; late: number; today: number; confirm: number; unrequested: number; external: number }) {
  if (value.late > 0) return `${value.late}件の遅延が集中しています`;
  if (value.today > 0) return `${value.today}件が今日締切です`;
  if (value.confirm > 0) return `${value.confirm}件が制作確認待ちです`;
  if (value.unrequested > 0) return `${value.unrequested}件の制作物が未依頼です`;
  if (value.external > 0) return `${value.external}件が外注対応中です`;
  return `${value.count}件の確認項目があります`;
}

function issueRisk(issue: ManagerIssue) {
  if (issue.tags.includes("遅延")) return "high";
  if (issue.tags.includes("今日") || issue.tags.includes("3日以内") || issue.tags.includes("確認待ち") || issue.tags.includes("未依頼")) return "warn";
  return "ok";
}

function managerIssueType(issue: ManagerIssue): "task" | "production" | "ticket" {
  if (issue.productionItemId) return "production";
  if (issue.ticketId) return "ticket";
  return "task";
}

function getManagerIssueRole(issue: ManagerIssue, project?: LiveProject): TaskRoleFilter {
  if (issue.ticketId) return "チケット";
  if (issue.productionItemId) return issue.owner === "外注" ? "制作・外注" : "デザイナー";
  const task = project?.tasks.find((current) => current.id === issue.taskId);
  return task ? getTaskRole(task) : "マネージャー";
}

function GroupList({
  activeGroup,
  groups,
  projects,
  onSelect,
}: {
  activeGroup: string;
  groups: GroupPage[];
  projects: LiveProject[];
  onSelect: (groupName: string) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollHint, setScrollHint] = useState({ top: false, bottom: false });
  const updateScrollHint = () => {
    const element = listRef.current;
    if (!element) return;
    const top = element.scrollTop > 4;
    const bottom = element.scrollTop + element.clientHeight < element.scrollHeight - 4;
    setScrollHint((current) =>
      current.top === top && current.bottom === bottom ? current : { top, bottom },
    );
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateScrollHint);
    window.addEventListener("resize", updateScrollHint);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateScrollHint);
    };
  }, [groups.length, projects.length]);

  return (
    <div className="groupListWrap">
      {scrollHint.top && (
        <div className="groupScrollHint groupScrollHintTop">
          <ChevronUp size={14} />
        </div>
      )}
      <div className="groupList" onScroll={updateScrollHint} ref={listRef}>
        {groups.map((group) => {
          const groupProjects = projects.filter((project) => project.group === group.name);
          const groupTasks = groupProjects.flatMap((project) => project.tasks);
          const lateCount = groupTasks.filter(isLate).length;

          return (
            <button
              className={activeGroup === group.name ? "active" : ""}
              key={group.name}
              onClick={() => onSelect(group.name)}
              type="button"
            >
              {group.photo ? (
                <img alt="" className="groupPhoto" src={group.photo} />
              ) : (
                <span className="groupPhoto groupPhotoFallback">{group.name.slice(0, 1)}</span>
              )}
              <strong>{group.name}</strong>
              {lateCount > 0 && <em>{lateCount}</em>}
            </button>
          );
        })}
      </div>
      {scrollHint.bottom && (
        <div className="groupScrollHint groupScrollHintBottom">
          <ChevronDown size={14} />
        </div>
      )}
    </div>
  );
}

function GroupEditor({
  editingGroupName,
  editorRef,
  form,
  notice,
  onChange,
  onSubmit,
}: {
  editingGroupName: string | null;
  editorRef: RefObject<HTMLDivElement | null>;
  form: GroupForm;
  notice: string;
  onChange: (form: GroupForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const applyPhotoFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange({ ...form, photo: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    applyPhotoFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handlePhotoDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    applyPhotoFile(event.dataTransfer.files[0]);
  };

  return (
    <div className="groupEditor" ref={editorRef}>
      <form className="groupEditorForm" onSubmit={onSubmit}>
        <label>
          <span>グループ名</span>
          <input
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            placeholder={editingGroupName ? "グループ名" : "新規グループ名"}
          />
        </label>
        <label>
          <span>担当</span>
          <select
            value={form.manager}
            onChange={(event) => onChange({ ...form, manager: event.target.value })}
          >
            {managers.map((manager) => (
              <option key={manager}>{manager}</option>
            ))}
          </select>
        </label>
        <label>
          <span>画像</span>
          <span
            className="groupPhotoDrop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handlePhotoDrop}
          >
            {form.photo ? (
              <img alt="" src={form.photo} />
            ) : (
              <small>ドラッグ&ドロップ / 選択</small>
            )}
            <input accept="image/*" onChange={handlePhotoSelect} type="file" />
          </span>
        </label>
        <label>
          <span>画像URL</span>
          <input
            value={form.photo}
            onChange={(event) => onChange({ ...form, photo: event.target.value })}
            placeholder="未入力なら自動設定 / アップロードでも可"
          />
        </label>
        <label>
          <span>カレンダーURL</span>
          <input
            value={form.calendarUrl}
            onChange={(event) => onChange({ ...form, calendarUrl: event.target.value })}
            placeholder="Google Calendar / ICS"
          />
        </label>
        <button className="primaryButton full" type="submit">
          {editingGroupName ? "更新" : "追加"}
        </button>
      </form>
      {notice && <p className="groupEditorNotice">{notice}</p>}
    </div>
  );
}

function TaskRow({
  task,
  selected,
  onSelectLive,
  onToggle,
  onStatusChange,
  onDelete,
  onSubtaskToggle,
  onSubtaskAdd,
}: {
  task: Task & { liveId: string; liveTitle: string; eventDate: string };
  selected: boolean;
  onSelectLive: () => void;
  onToggle: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onDelete: () => void;
  onSubtaskToggle: (subtaskId: string) => void;
  onSubtaskAdd: (title: string) => void;
}) {
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const subtaskStats = getSubtaskStats(task);
  const hasSubtasks = Boolean(task.subtasks?.length);
  const addDraftSubtask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = subtaskDraft.trim();
    if (!title) return;
    onSubtaskAdd(title);
    setSubtaskDraft("");
  };

  return (
    <article
      className={`taskRow ${isLate(task) ? "late" : ""} ${task.status === "完了" ? "done" : ""} ${
        selected ? "selected" : ""
      }`}
      id={`task-${task.liveId}-${task.id}`}
    >
      <button className="checkButton" onClick={onToggle} type="button" aria-label="完了切替">
        {task.status === "完了" && <Check size={15} />}
      </button>
      <button
        className="taskBody selectable"
        onClick={onSelectLive}
        type="button"
      >
        <div className="taskMeta">
          <PhaseBadge phase={task.phase} />
          <PriorityBadge priority={task.priority} />
          <DueBadge date={task.dueDate} done={task.status === "完了"} />
        </div>
        <h3>{task.title}</h3>
        {hasSubtasks && (
          <span className="subtaskSummary">
            サブタスク {subtaskStats.done}/{subtaskStats.total}
          </span>
        )}
        {task.memo && <small>{task.memo}</small>}
      </button>
      <div className="taskOps">
        <span>
          <UserRound size={14} />
          {task.owner}
        </span>
        <label className="selectBox">
          <select value={task.status} onChange={(event) => onStatusChange(event.target.value as TaskStatus)}>
            <option>未着手</option>
            <option>進行中</option>
            <option>完了</option>
          </select>
          <ChevronDown size={14} />
        </label>
        <button className="taskDeleteButton" onClick={onDelete} type="button" aria-label="タスクを削除">
          <Trash2 size={14} />
        </button>
      </div>
      {selected && (
        <div className="subtaskPanel">
          {hasSubtasks ? (
            task.subtasks?.map((subtask) => (
              <button
                className={subtask.done ? "done" : ""}
                key={subtask.id}
                onClick={() => onSubtaskToggle(subtask.id)}
                type="button"
              >
                <span>{subtask.done && <Check size={13} />}</span>
                <b>{subtask.title}</b>
              </button>
            ))
          ) : (
            <div className="subtaskEmpty">サブタスクはありません</div>
          )}
          <form className="subtaskAddForm" onSubmit={addDraftSubtask}>
            <input
              value={subtaskDraft}
              onChange={(event) => setSubtaskDraft(event.target.value)}
              placeholder="サブタスクを追加"
            />
            <button type="submit">追加</button>
          </form>
        </div>
      )}
    </article>
  );
}

function LiveCard({
  project,
  selected,
  onSelect,
}: {
  project: LiveProject;
  selected: boolean;
  onSelect: () => void;
}) {
  const late = project.tasks.filter(isLate).length;
  const listStatus = project.status === "完了" ? "完了" : late > 0 ? "遅延" : null;
  return (
    <button className={`liveCard ${selected ? "selected" : ""}`} onClick={onSelect} type="button">
      <div>
        <strong>{project.title}</strong>
        <span>@{project.venue}</span>
      </div>
      <div className="liveCardMeta">
        {listStatus && <StatusPill value={listStatus} />}
        <b>{formatDate(project.eventDate)}</b>
      </div>
    </button>
  );
}

function ExternalLiveCard({ item, onSelect }: { item: CalendarItem; onSelect: () => void }) {
  const hasVenue = Boolean(item.liveTitle && item.liveTitle !== "休み");

  return (
    <button className="liveCard externalLiveCard" onClick={onSelect} type="button">
      <div>
        <strong>{item.title}</strong>
        {hasVenue && <span>@{item.liveTitle}</span>}
      </div>
      <div className="liveCardMeta">
        <b>
          {formatDate(item.date)}
          {item.time ? ` ${item.time}` : ""}
        </b>
      </div>
    </button>
  );
}

function LiveSummary({
  project,
  onAddProductionItem,
  onAddTicket,
  onDeleteProductionItem,
  onDeleteTicket,
  onDriveFolderUrlChange,
  onLiveDetailChange,
  onLiveStatusChange,
  onTicketChange,
  onProductionItemChange,
}: {
  project: LiveProject;
  onAddProductionItem: () => string;
  onAddTicket: () => string;
  onDeleteProductionItem: (itemId: string) => void;
  onDeleteTicket: (ticketId: string) => void;
  onDriveFolderUrlChange: (driveFolderUrl: string) => void;
  onLiveDetailChange: (updates: Partial<Pick<LiveProject, "ticketLaunch" | "rehearsal" | "photoShoot" | "productionCompany">>) => void;
  onLiveStatusChange: (status: LiveStatus) => void;
  onTicketChange: (ticketId: string, updates: Partial<TicketPlan>) => void;
  onProductionItemChange: (itemId: string, updates: Partial<ProductionItem>) => void;
}) {
  const late = project.tasks.filter(isLate).length;
  const requiredOpen = project.tasks.filter(
    (task) => task.priority === "必須" && task.status !== "完了",
  ).length;

  return (
    <div className="liveSummary">
      <div className="summaryTitle">
        <div>
          <h3>
            <span className="summaryDate">{formatDate(project.eventDate)}</span>
            {project.title}
          </h3>
        </div>
        <div className="summaryActions">
          <StatusPill value={project.status === "完了" ? "完了" : late > 0 ? "遅延" : project.status} />
          <button
            className="archiveButton"
            onClick={() => onLiveStatusChange(project.status === "完了" ? "進行中" : "完了")}
            type="button"
          >
            {project.status === "完了" ? "未に戻す" : "完了へ"}
          </button>
        </div>
      </div>

      <div className="summaryInline">
        <span>
          残り <b>{daysUntil(project.eventDate)}日</b>
        </span>
        <span className={late > 0 ? "warn" : ""}>
          遅延 <b>{late}件</b>
        </span>
        <span>
          必須 <b>{requiredOpen}件</b>
        </span>
      </div>

      <div className="phaseGrid">
        {phaseOrder.map((phase) => {
          const tasks = project.tasks.filter((task) => task.phase === phase);
          const done = tasks.filter((task) => task.status === "完了").length;
          return (
            <div key={phase}>
              <span>{phase}</span>
              <b>
                {done}/{tasks.length}
              </b>
            </div>
          );
        })}
      </div>

      <InfoList
        items={[
          ["会場", project.venue],
          ["担当", project.manager],
          ["チケット発売", formatDateTime(project.ticketLaunch)],
          ["ゲネプロ", formatSchedule(project.rehearsal)],
          ["撮影", formatSchedule(project.photoShoot)],
          ["制作会社", project.productionCompany],
        ]}
      />

      <LiveScheduleFields
        photoShoot={project.photoShoot}
        productionCompany={project.productionCompany}
        rehearsal={project.rehearsal}
        ticketLaunch={project.ticketLaunch}
        onChange={onLiveDetailChange}
      />

      <DriveFolderField
        url={project.driveFolderUrl ?? ""}
        onChange={onDriveFolderUrlChange}
      />

      <TicketManager
        tickets={project.tickets}
        onAddTicket={onAddTicket}
        onDeleteTicket={onDeleteTicket}
        onTicketChange={onTicketChange}
      />

      <ProductionManager
        items={project.productionItems}
        onAddProductionItem={onAddProductionItem}
        onDeleteProductionItem={onDeleteProductionItem}
        onProductionItemChange={onProductionItemChange}
      />
    </div>
  );
}

function LiveScheduleFields({
  photoShoot,
  productionCompany,
  rehearsal,
  ticketLaunch,
  onChange,
}: {
  photoShoot: string;
  productionCompany: string;
  rehearsal: string;
  ticketLaunch: string;
  onChange: (updates: Partial<Pick<LiveProject, "ticketLaunch" | "rehearsal" | "photoShoot" | "productionCompany">>) => void;
}) {
  return (
    <CompactSection icon={<CalendarDays size={15} />} title="日程メモ">
      <div className="liveScheduleFields">
        <label>
          <span>チケット発売</span>
          <input
            aria-label="チケット発売"
            type="datetime-local"
            value={toDateTimeLocalInput(ticketLaunch)}
            onChange={(event) => onChange({ ticketLaunch: event.target.value })}
          />
        </label>
        <label>
          <span>ゲネプロ</span>
          <input
            aria-label="ゲネプロ"
            value={rehearsal}
            onChange={(event) => onChange({ rehearsal: event.target.value })}
          />
        </label>
        <label>
          <span>撮影</span>
          <input
            aria-label="撮影"
            value={photoShoot}
            onChange={(event) => onChange({ photoShoot: event.target.value })}
          />
        </label>
        <label>
          <span>制作会社</span>
          <input
            aria-label="制作会社"
            value={productionCompany === "未設定" ? "" : productionCompany}
            onChange={(event) => onChange({ productionCompany: event.target.value.trim() || "未設定" })}
          />
        </label>
      </div>
    </CompactSection>
  );
}

function TicketManager({
  tickets,
  onAddTicket,
  onDeleteTicket,
  onTicketChange,
}: {
  tickets: TicketPlan[];
  onAddTicket: () => string;
  onDeleteTicket: (ticketId: string) => void;
  onTicketChange: (ticketId: string, updates: Partial<TicketPlan>) => void;
}) {
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [pendingDeleteTicketId, setPendingDeleteTicketId] = useState("");
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);

  useEffect(() => {
    if (selectedTicketId && !tickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId("");
    }
    if (pendingDeleteTicketId && !tickets.some((ticket) => ticket.id === pendingDeleteTicketId)) {
      setPendingDeleteTicketId("");
    }
  }, [pendingDeleteTicketId, selectedTicketId, tickets]);

  useEffect(() => {
    if (!pendingDeleteTicketId) return;
    const resetPendingDelete = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".editorDangerZone")) return;
      setPendingDeleteTicketId("");
    };
    document.addEventListener("pointerdown", resetPendingDelete);
    return () => document.removeEventListener("pointerdown", resetPendingDelete);
  }, [pendingDeleteTicketId]);

  return (
    <CompactSection
      action={
        <button
          aria-label="チケット追加"
          className="sectionAddButton"
          onClick={() => setSelectedTicketId(onAddTicket())}
          type="button"
        >
          <Plus size={16} />
        </button>
      }
      icon={<Ticket size={17} />}
      title="チケット"
    >
      <div className="ticketRows">
        {tickets.map((ticket) => {
          const status = ticketStatus(ticket);
          const isSelected = selectedTicket?.id === ticket.id;
          return (
            <div className="ticketEntry" key={ticket.id}>
              <button
                className={`ticketRow ${isSelected ? "active" : ""}`}
                onClick={() => setSelectedTicketId((current) => (current === ticket.id ? "" : ticket.id))}
                type="button"
              >
                <div>
                  <strong>{ticket.name}</strong>
                  <span>
                    {ticket.price.toLocaleString("ja-JP")}円 / {formatDateTime(ticket.saleStart)}
                  </span>
                  {!ticket.pageUrl && <em>URL未入力</em>}
                </div>
                <StatusPill value={status} />
              </button>

              {isSelected && (
                <TicketEditor
                  pendingDelete={pendingDeleteTicketId === ticket.id}
                  ticket={ticket}
                  onDelete={() => {
                    if (pendingDeleteTicketId !== ticket.id) {
                      setPendingDeleteTicketId(ticket.id);
                      return;
                    }
                    onDeleteTicket(ticket.id);
                    setPendingDeleteTicketId("");
                  }}
                  onTicketChange={(ticketId, updates) => {
                    setPendingDeleteTicketId("");
                    onTicketChange(ticketId, updates);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </CompactSection>
  );
}

function DriveFolderField({
  url,
  onChange,
}: {
  url: string;
  onChange: (url: string) => void;
}) {
  const trimmedUrl = url.trim();

  return (
    <CompactSection icon={<PackageCheck size={17} />} title="Driveフォルダ">
      <div className="driveFolderField">
        <input
          aria-label="Google DriveフォルダURL"
          placeholder="Google DriveフォルダURL"
          value={url}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          disabled={!trimmedUrl}
          onClick={() => window.open(trimmedUrl, "_blank", "noopener,noreferrer")}
          type="button"
        >
          開く
        </button>
      </div>
      {!trimmedUrl && <small className="driveFolderHint">既存のDriveフォルダURLを登録できます。</small>}
    </CompactSection>
  );
}

function TicketEditor({
  pendingDelete,
  ticket,
  onDelete,
  onTicketChange,
}: {
  pendingDelete: boolean;
  ticket: TicketPlan;
  onDelete: () => void;
  onTicketChange: (ticketId: string, updates: Partial<TicketPlan>) => void;
}) {
  const saleDate = ticket.saleStart.slice(0, 10);
  const saleTime = ticket.saleStart.includes("T") ? ticket.saleStart.split("T")[1].slice(0, 5) : "20:00";
  const [isPriceFocused, setIsPriceFocused] = useState(false);
  const updateSaleDate = (date: string) => onTicketChange(ticket.id, { saleStart: `${date}T${saleTime}` });
  const updateSaleTime = (time: string) => onTicketChange(ticket.id, { saleStart: `${saleDate}T${time}` });

  return (
    <div className="ticketEditor">
      <label>
        <span>券種</span>
        <input
          value={ticket.name}
          onChange={(event) => onTicketChange(ticket.id, { name: event.target.value })}
        />
      </label>
      <label>
        <span>価格</span>
        <input
          inputMode="numeric"
          onBlur={() => setIsPriceFocused(false)}
          onChange={(event) => {
            const numericValue = event.target.value.replace(/[^\d]/g, "");
            onTicketChange(ticket.id, { price: Number(numericValue) || 0 });
          }}
          onFocus={() => setIsPriceFocused(true)}
          value={isPriceFocused ? String(ticket.price) : ticket.price.toLocaleString("ja-JP")}
        />
      </label>
      <DatePickerField label="発売日" value={saleDate} onChange={updateSaleDate} />
      <label>
        <span>発売時間</span>
        <div className="timeSelectField">
          <select
            aria-label="発売時間"
            value={saleTime}
            onChange={(event) => updateSaleTime(event.target.value)}
          >
            {fiveMinuteTimes.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
          <Clock3 size={15} />
        </div>
      </label>
      <label>
        <span>状態</span>
        <select
          value={ticketStatus(ticket)}
          onChange={(event) => onTicketChange(ticket.id, { status: event.target.value as TicketStatus })}
        >
          {ticketStatuses.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>
      <label className="wide">
        <span>URL</span>
        <input
          value={ticket.pageUrl ?? ""}
          onChange={(event) => onTicketChange(ticket.id, { pageUrl: event.target.value })}
        />
      </label>
      <label className="wide">
        <span>特典</span>
        <input
          value={ticket.benefit}
          onChange={(event) => onTicketChange(ticket.id, { benefit: event.target.value })}
        />
      </label>
      <div className="editorDangerZone">
        {ticket.pageUrl?.trim() && (
          <button
            className="editorOpenButton"
            onClick={() => window.open(ticket.pageUrl, "_blank", "noopener,noreferrer")}
            type="button"
          >
            開く
          </button>
        )}
        <button className={pendingDelete ? "confirm" : ""} onClick={onDelete} type="button">
          {pendingDelete ? "もう一度押すと削除" : "削除"}
        </button>
      </div>
    </div>
  );
}

function ProductionManager({
  items,
  onAddProductionItem,
  onDeleteProductionItem,
  onProductionItemChange,
}: {
  items: ProductionItem[];
  onAddProductionItem: () => string;
  onDeleteProductionItem: (itemId: string) => void;
  onProductionItemChange: (itemId: string, updates: Partial<ProductionItem>) => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState("");
  const [productionView, setProductionView] = useState<"未完了" | "全て">("未完了");
  const visibleItems =
    productionView === "未完了" ? items.filter((item) => item.status !== "納品済") : items;
  const selectedItem = items.find((item) => item.id === selectedItemId);

  useEffect(() => {
    if (selectedItemId && !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId("");
    }
    if (pendingDeleteItemId && !items.some((item) => item.id === pendingDeleteItemId)) {
      setPendingDeleteItemId("");
    }
  }, [items, pendingDeleteItemId, selectedItemId]);

  useEffect(() => {
    if (!pendingDeleteItemId) return;
    const resetPendingDelete = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".editorDangerZone")) return;
      setPendingDeleteItemId("");
    };
    document.addEventListener("pointerdown", resetPendingDelete);
    return () => document.removeEventListener("pointerdown", resetPendingDelete);
  }, [pendingDeleteItemId]);

  return (
    <CompactSection
      action={
        <button
          aria-label="制作物追加"
          className="sectionAddButton"
          onClick={() => setSelectedItemId(onAddProductionItem())}
          type="button"
        >
          <Plus size={16} />
        </button>
      }
      icon={<PackageCheck size={17} />}
      title="制作物"
    >
      <div className="productionViewTabs">
        {(["未完了", "全て"] as const).map((view) => (
          <button
            className={productionView === view ? "active" : ""}
            key={view}
            onClick={() => setProductionView(view)}
            type="button"
          >
            {view}
            <span>{view === "未完了" ? items.filter((item) => item.status !== "納品済").length : items.length}</span>
          </button>
        ))}
      </div>
      <div className="productionRows">
        {visibleItems.map((item) => {
          const isSelected = selectedItem?.id === item.id;
          const late = isProductionLate(item);
          return (
            <div className="productionEntry" key={item.id}>
              <div className={`productionRow ${isSelected ? "active" : ""} ${late ? "late" : ""}`}>
                <button
                  className="productionRowMain"
                  onClick={() => setSelectedItemId((current) => (current === item.id ? "" : item.id))}
                  type="button"
                >
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.vendor} / {formatDate(item.dueDate)}
                    </span>
                    {late && <em>{Math.abs(daysUntil(item.dueDate))}日遅れ</em>}
                  </div>
                </button>
                <div className="productionRowActions">
                  <StatusPill value={item.status} />
                </div>
              </div>

              {isSelected && (
                <ProductionEditor
                  item={item}
                  pendingDelete={pendingDeleteItemId === item.id}
                  onDelete={() => {
                    if (pendingDeleteItemId !== item.id) {
                      setPendingDeleteItemId(item.id);
                      return;
                    }
                    onDeleteProductionItem(item.id);
                    setPendingDeleteItemId("");
                  }}
                  onProductionItemChange={(itemId, updates) => {
                    setPendingDeleteItemId("");
                    onProductionItemChange(itemId, updates);
                  }}
                />
              )}
            </div>
          );
        })}
        {visibleItems.length === 0 && <div className="miniEmpty">表示する制作物はありません</div>}
      </div>
    </CompactSection>
  );
}

function ProductionEditor({
  item,
  pendingDelete,
  onDelete,
  onProductionItemChange,
}: {
  item: ProductionItem;
  pendingDelete: boolean;
  onDelete: () => void;
  onProductionItemChange: (itemId: string, updates: Partial<ProductionItem>) => void;
}) {
  return (
    <div className={`productionEditor ${isProductionLate(item) ? "late" : ""}`}>
      <label>
        <span>制作物</span>
        <input
          value={item.name}
          onChange={(event) => onProductionItemChange(item.id, { name: event.target.value })}
        />
      </label>
      <label>
        <span>担当</span>
        <select
          value={item.owner}
          onChange={(event) => onProductionItemChange(item.id, { owner: event.target.value })}
        >
          {managers.map((manager) => (
            <option key={manager}>{manager}</option>
          ))}
        </select>
      </label>
      <label>
        <span>外注先</span>
        <input
          value={item.vendor}
          onChange={(event) => onProductionItemChange(item.id, { vendor: event.target.value })}
        />
      </label>
      <label>
        <span>担当デザイナー</span>
        <input
          value={item.designer ?? ""}
          onChange={(event) => onProductionItemChange(item.id, { designer: event.target.value })}
        />
      </label>
      <label>
        <span>締切</span>
        <DatePickerField
          label="締切"
          value={item.dueDate}
          onChange={(date) => onProductionItemChange(item.id, { dueDate: date })}
          hideLabel
        />
      </label>
      <label>
        <span>状態</span>
        <select
          value={item.status}
          onChange={(event) =>
            onProductionItemChange(item.id, { status: event.target.value as ProductionStatus })
          }
        >
          {productionStatuses.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>
      <label className="wide">
        <span>URL</span>
        <input
          value={item.fileUrl ?? ""}
          onChange={(event) => onProductionItemChange(item.id, { fileUrl: event.target.value })}
        />
      </label>
      <label className="wide">
        <span>メモ</span>
        <textarea
          value={item.memo ?? ""}
          onChange={(event) => onProductionItemChange(item.id, { memo: event.target.value })}
        />
      </label>
      <div className="editorDangerZone">
        {item.fileUrl?.trim() && (
          <button
            className="editorOpenButton"
            onClick={() => window.open(item.fileUrl, "_blank", "noopener,noreferrer")}
            type="button"
          >
            開く
          </button>
        )}
        <button className={pendingDelete ? "confirm" : ""} onClick={onDelete} type="button">
          {pendingDelete ? "もう一度押すと削除" : "削除"}
        </button>
      </div>
    </div>
  );
}

function RunScheduleManager({
  project,
  runScheduleTemplates,
  selectedTemplateId,
  onScheduleItemsChange,
  onSelectedTemplateChange,
  onTemplateSave,
}: {
  project: LiveProject;
  runScheduleTemplates: RunScheduleTemplateSet[];
  selectedTemplateId: string;
  onScheduleItemsChange: (scheduleItems: RunScheduleItem[]) => void;
  onSelectedTemplateChange: (templateId: string) => void;
  onTemplateSave: (template: RunScheduleTemplateSet) => void;
}) {
  const scheduleItems = useMemo(
    () =>
      sortRunSchedule(
        project.scheduleItems ?? defaultRunSchedule(project.id, project.eventDate, project.liveType, project.manager),
      ),
    [project.eventDate, project.id, project.liveType, project.manager, project.scheduleItems],
  );
  const [activeDay, setActiveDay] = useState<RunScheduleDay>("当日");
  const [ownerKindFilter, setOwnerKindFilter] = useState<RunScheduleOwnerFilter>("全て");
  const selectedTemplate =
    runScheduleTemplates.find((template) => template.id === selectedTemplateId) ?? runScheduleTemplates[0];
  const [isRunTemplateEditorOpen, setIsRunTemplateEditorOpen] = useState(false);
  const [runTemplateDraft, setRunTemplateDraft] = useState<RunScheduleTemplateSet>(() =>
    cloneRunScheduleTemplateSet(selectedTemplate ?? createDefaultRunScheduleTemplateSet()),
  );
  const [isRunTemplatePreviewOpen, setIsRunTemplatePreviewOpen] = useState(false);
  const [runTemplateScrollHint, setRunTemplateScrollHint] = useState({
    top: false,
    bottom: false,
    left: false,
    right: false,
  });
  const runTemplateRowsRef = useRef<HTMLDivElement | null>(null);
  const [newItem, setNewItem] = useState({
    time: "10:00",
    title: "",
    ownerKind: "FOCスタッフ" as RunScheduleOwnerKind,
    owner: project.manager,
    place: "",
    note: "",
  });
  const filteredScheduleItems =
    ownerKindFilter === "全て"
      ? scheduleItems
      : scheduleItems.filter((item) => getRunScheduleOwnerKind(item) === ownerKindFilter);
  const visibleItems = filteredScheduleItems.filter((item) => item.day === activeDay);

  useEffect(() => {
    setNewItem((current) => ({
      ...current,
      owner: project.manager,
    }));
  }, [project.manager]);

  const updateRunTemplateScrollHint = () => {
    const element = runTemplateRowsRef.current;
    if (!element) return;
    const next = {
      top: element.scrollTop > 2,
      bottom: element.scrollTop + element.clientHeight < element.scrollHeight - 2,
      left: element.scrollLeft > 2,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
    };
    setRunTemplateScrollHint((current) =>
      current.top === next.top &&
      current.bottom === next.bottom &&
      current.left === next.left &&
      current.right === next.right
        ? current
        : next,
    );
  };

  useEffect(() => {
    if (!isRunTemplateEditorOpen) return;
    const frame = window.requestAnimationFrame(updateRunTemplateScrollHint);
    window.addEventListener("resize", updateRunTemplateScrollHint);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateRunTemplateScrollHint);
    };
  }, [isRunTemplateEditorOpen, runTemplateDraft.items.length]);

  const setSchedule = (items: RunScheduleItem[]) => onScheduleItemsChange(sortRunSchedule(items));
  const updateItem = (itemId: string, updates: Partial<RunScheduleItem>) => {
    setSchedule(scheduleItems.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  };
  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newItem.title.trim();
    if (!title) return;
    setSchedule([
      ...scheduleItems,
      {
        id: `schedule-${crypto.randomUUID()}`,
        day: activeDay,
        time: newItem.time,
        title,
        ownerKind: newItem.ownerKind,
        owner: newItem.owner,
        place: newItem.place.trim(),
        note: newItem.note.trim(),
      },
    ]);
    setNewItem((current) => ({ ...current, title: "", place: "", note: "" }));
  };
  const deleteItem = (itemId: string) => {
    setSchedule(scheduleItems.filter((item) => item.id !== itemId));
  };
  const openRunTemplateEditor = () => {
    setRunTemplateDraft(cloneRunScheduleTemplateSet(selectedTemplate ?? createDefaultRunScheduleTemplateSet()));
    setIsRunTemplateEditorOpen(true);
  };
  const startRunTemplateFromCurrent = () => {
    setRunTemplateDraft({
      id: `run-template-${crypto.randomUUID()}`,
      name: `${project.liveType}進行表`,
      liveType: project.liveType,
      items: scheduleItems.map(({ id: _id, ...item }) => item),
    });
    setIsRunTemplateEditorOpen(true);
  };
  const updateRunTemplateDraftItem = (itemIndex: number, updates: Partial<RunScheduleTemplateItem>) => {
    setRunTemplateDraft((current) => ({
      ...current,
      items: current.items.map((item, index) => (index === itemIndex ? { ...item, ...updates } : item)),
    }));
  };
  const addRunTemplateDraftItem = () => {
    setRunTemplateDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          day: activeDay,
          time: "10:00",
          title: "",
          ownerKind: "FOCスタッフ",
          owner: project.manager,
          place: "",
          note: "",
        },
      ],
    }));
  };
  const deleteRunTemplateDraftItem = (itemIndex: number) => {
    setRunTemplateDraft((current) => ({
      ...current,
      items: current.items.length <= 1 ? current.items : current.items.filter((_, index) => index !== itemIndex),
    }));
  };
  const saveRunTemplateDraft = () => {
    const name = runTemplateDraft.name.trim();
    const items = runTemplateDraft.items
      .map((item) => ({
        ...item,
        title: item.title.trim(),
        place: item.place.trim(),
        note: item.note?.trim() || "",
      }))
      .filter((item) => item.title);
    if (!name || items.length === 0) return;
    const savedTemplate = {
      ...runTemplateDraft,
      name,
      items: sortRunSchedule(items.map((item, index) => ({ ...item, id: `draft-${index}` }))).map(
        ({ id: _id, ...item }) => item,
      ),
    };
    onTemplateSave(savedTemplate);
    onSelectedTemplateChange(savedTemplate.id);
    setIsRunTemplateEditorOpen(false);
  };
  const applyRunTemplate = () => {
    if (!selectedTemplate) return;
    setIsRunTemplatePreviewOpen(true);
  };
  const confirmRunTemplateApply = () => {
    if (!selectedTemplate) return;
    setSchedule(buildRunScheduleFromTemplate(project.id, selectedTemplate.items));
    setIsRunTemplatePreviewOpen(false);
  };

  return (
    <>
    <CompactSection icon={<CalendarDays size={17} />} title="進行表">
      <div className="runScheduleToolbar">
        <div className="runScheduleTabs">
          {(["前日", "当日"] as RunScheduleDay[]).map((day) => (
            <button
              className={activeDay === day ? "active" : ""}
              key={day}
              onClick={() => setActiveDay(day)}
              type="button"
            >
              {day}
            </button>
          ))}
        </div>
        <div className="runScheduleActions">
          <label className="runScheduleFilter runTemplateSelect">
            <span>テンプレート</span>
            <select value={selectedTemplateId} onChange={(event) => onSelectedTemplateChange(event.target.value)}>
              {runScheduleTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={applyRunTemplate} type="button">
            <CopyPlus size={14} />
            読込
          </button>
          <button onClick={openRunTemplateEditor} type="button">
            <Pencil size={14} />
            設定
          </button>
          <label className="runScheduleFilter">
            <span>担当区分</span>
            <select
              value={ownerKindFilter}
              onChange={(event) => setOwnerKindFilter(event.target.value as RunScheduleOwnerFilter)}
            >
              <option>全て</option>
              {runScheduleOwnerKinds.map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => window.alert("Slack連携は今後の実装想定です。")}
            type="button"
          >
            <Send size={14} />
            Slackへ送信
          </button>
          <button onClick={() => printRunSchedule(project, scheduleItems)} type="button">
            <Printer size={14} />
            全体PDF
          </button>
          <button
            disabled={ownerKindFilter === "全て"}
            onClick={() => printRunSchedule(project, filteredScheduleItems, ownerKindFilter)}
            type="button"
          >
            <Printer size={14} />
            表示中PDF
          </button>
        </div>
      </div>

      <div className="runScheduleRows">
        {visibleItems.map((item) => (
          <div className="runScheduleRow" key={item.id}>
            <select
              aria-label="時刻"
              value={item.time}
              onChange={(event) => updateItem(item.id, { time: event.target.value })}
            >
              {fiveMinuteTimes.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <input
              aria-label="内容"
              value={item.title}
              onChange={(event) => updateItem(item.id, { title: event.target.value })}
            />
            <select
              aria-label="担当区分"
              className={`ownerKindSelect ${ownerKindClass(getRunScheduleOwnerKind(item))}`}
              value={getRunScheduleOwnerKind(item)}
              onChange={(event) =>
                updateItem(item.id, { ownerKind: event.target.value as RunScheduleOwnerKind })
              }
            >
              {runScheduleOwnerKinds.map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
            <select
              aria-label="担当"
              value={item.owner}
              onChange={(event) => updateItem(item.id, { owner: event.target.value })}
            >
              {managers.map((manager) => (
                <option key={manager}>{manager}</option>
              ))}
            </select>
            <input
              aria-label="場所"
              value={item.place}
              onChange={(event) => updateItem(item.id, { place: event.target.value })}
            />
            <input
              aria-label="メモ"
              className="scheduleNoteInput"
              placeholder="メモ"
              value={item.note ?? ""}
              onChange={(event) => updateItem(item.id, { note: event.target.value })}
            />
            <button aria-label="削除" className="scheduleDeleteButton" onClick={() => deleteItem(item.id)} type="button">
              <X size={14} />
            </button>
          </div>
        ))}
        {visibleItems.length === 0 && <div className="scheduleEmpty">予定はありません</div>}
      </div>

      <form className="runScheduleAdd" onSubmit={addItem}>
        <select
          aria-label="追加時刻"
          value={newItem.time}
          onChange={(event) => setNewItem({ ...newItem, time: event.target.value })}
        >
          {fiveMinuteTimes.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
        <input
          aria-label="追加内容"
          placeholder={`${activeDay}の予定を追加`}
          value={newItem.title}
          onChange={(event) => setNewItem({ ...newItem, title: event.target.value })}
        />
        <select
          aria-label="追加担当区分"
          className={`ownerKindSelect ${ownerKindClass(newItem.ownerKind)}`}
          value={newItem.ownerKind}
          onChange={(event) =>
            setNewItem({ ...newItem, ownerKind: event.target.value as RunScheduleOwnerKind })
          }
        >
          {runScheduleOwnerKinds.map((kind) => (
            <option key={kind}>{kind}</option>
          ))}
        </select>
        <select
          aria-label="追加担当"
          value={newItem.owner}
          onChange={(event) => setNewItem({ ...newItem, owner: event.target.value })}
        >
          {managers.map((manager) => (
            <option key={manager}>{manager}</option>
          ))}
        </select>
        <input
          aria-label="追加場所"
          placeholder="場所"
          value={newItem.place}
          onChange={(event) => setNewItem({ ...newItem, place: event.target.value })}
        />
        <input
          aria-label="追加メモ"
          placeholder="メモ"
          value={newItem.note}
          onChange={(event) => setNewItem({ ...newItem, note: event.target.value })}
        />
        <button aria-label="追加" type="submit">
          <Plus size={17} />
        </button>
      </form>
    </CompactSection>
    {isRunTemplateEditorOpen && (
      <aside className="runTemplateEditor">
        <div className="drawerHeader templateHeader">
          <div>
            <h2>進行表テンプレート</h2>
            <span>前日・当日の流れをテンプレートとして登録します</span>
          </div>
          <button className="iconButton" onClick={() => setIsRunTemplateEditorOpen(false)} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="templateTop">
          <label>
            <span>編集するテンプレート</span>
            <select
              value={runTemplateDraft.id}
              onChange={(event) => {
                const template = runScheduleTemplates.find((item) => item.id === event.target.value);
                if (template) setRunTemplateDraft(cloneRunScheduleTemplateSet(template));
              }}
            >
              {runScheduleTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <button className="secondaryButton" onClick={startRunTemplateFromCurrent} type="button">
            <CopyPlus size={15} />
            現在から作成
          </button>
        </div>

        <div className="templateMeta">
          <label>
            <span>テンプレート名</span>
            <input
              value={runTemplateDraft.name}
              onChange={(event) => setRunTemplateDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            <span>対象</span>
            <select
              value={runTemplateDraft.liveType}
              onChange={(event) =>
                setRunTemplateDraft((current) => ({
                  ...current,
                  liveType: event.target.value as RunScheduleTemplateSet["liveType"],
                }))
              }
            >
              <option>共通</option>
              <option>ワンマン</option>
              <option>定期公演</option>
              <option>生誕祭</option>
            </select>
          </label>
        </div>

        <div className="runTemplateRowsShell">
          {runTemplateScrollHint.top && (
            <div className="runTemplateScrollHint runTemplateScrollHintTop">
              <ChevronUp size={15} />
            </div>
          )}
          {runTemplateScrollHint.bottom && (
            <div className="runTemplateScrollHint runTemplateScrollHintBottom">
              <ChevronDown size={15} />
            </div>
          )}
          {runTemplateScrollHint.left && (
            <div className="runTemplateScrollHint runTemplateScrollHintLeft">
              <ChevronLeft size={15} />
            </div>
          )}
          {runTemplateScrollHint.right && (
            <div className="runTemplateScrollHint runTemplateScrollHintRight">
              <ChevronRight size={15} />
            </div>
          )}
          <div className="runTemplateRows" onScroll={updateRunTemplateScrollHint} ref={runTemplateRowsRef}>
            {(["前日", "当日"] as RunScheduleDay[]).map((day) => {
              const rows = runTemplateDraft.items
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.day === day)
                .sort((a, b) => a.item.time.localeCompare(b.item.time));
              return (
                <section className="runTemplateEditSection" key={day}>
                  <h3>{day}テンプレート</h3>
                  <div className="runTemplateColumnLabels">
                    <span>時刻</span>
                    <span>内容</span>
                    <span>担当区分</span>
                    <span>担当</span>
                    <span>場所</span>
                    <span>メモ</span>
                    <span>削除</span>
                  </div>
                  <div className="runTemplateEditTimeline">
                    {rows.map(({ item, index }) => (
                      <div className="runTemplateRow" key={`${item.day}-${item.time}-${index}`}>
                        <select
                          aria-label="時刻"
                          value={item.time}
                          onChange={(event) => updateRunTemplateDraftItem(index, { time: event.target.value })}
                        >
                          {fiveMinuteTimes.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label="内容"
                          value={item.title}
                          onChange={(event) => updateRunTemplateDraftItem(index, { title: event.target.value })}
                          placeholder="内容"
                        />
                        <select
                          aria-label="担当区分"
                          className={`ownerKindSelect ${ownerKindClass(getRunScheduleOwnerKind(item))}`}
                          value={getRunScheduleOwnerKind(item)}
                          onChange={(event) =>
                            updateRunTemplateDraftItem(index, { ownerKind: event.target.value as RunScheduleOwnerKind })
                          }
                        >
                          {runScheduleOwnerKinds.map((kind) => (
                            <option key={kind}>{kind}</option>
                          ))}
                        </select>
                        <select
                          aria-label="担当"
                          value={item.owner}
                          onChange={(event) => updateRunTemplateDraftItem(index, { owner: event.target.value })}
                        >
                          {managers.map((manager) => (
                            <option key={manager}>{manager}</option>
                          ))}
                        </select>
                        <input
                          aria-label="場所"
                          value={item.place}
                          onChange={(event) => updateRunTemplateDraftItem(index, { place: event.target.value })}
                          placeholder="場所"
                        />
                        <input
                          aria-label="メモ"
                          value={item.note ?? ""}
                          onChange={(event) => updateRunTemplateDraftItem(index, { note: event.target.value })}
                          placeholder="メモ"
                        />
                        <button
                          aria-label="削除"
                          className="scheduleDeleteButton"
                          disabled={runTemplateDraft.items.length <= 1}
                          onClick={() => deleteRunTemplateDraftItem(index)}
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {rows.length === 0 && <div className="runTemplatePreviewEmpty">予定はありません</div>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="templateFooter">
          <button className="secondaryButton" onClick={addRunTemplateDraftItem} type="button">
            <Plus size={15} />
            {activeDay}に行を追加
          </button>
          <button className="primaryButton" onClick={saveRunTemplateDraft} type="button">
            保存
          </button>
        </div>
      </aside>
    )}
    {isRunTemplatePreviewOpen && selectedTemplate && (
      <aside className="runTemplatePreview">
        <div className="drawerHeader templateHeader">
          <div>
            <h2>{selectedTemplate.name}を読み込み</h2>
            <span>現在の進行表は、この内容で置き換わります</span>
          </div>
          <button className="iconButton" onClick={() => setIsRunTemplatePreviewOpen(false)} type="button">
            <X size={20} />
          </button>
        </div>
        <div className="runTemplatePreviewRows">
          {(["前日", "当日"] as RunScheduleDay[]).map((day) => {
            const rows = sortRunSchedule(
              selectedTemplate.items
                .map((item, index) => ({ ...item, id: `preview-${index}` }))
                .filter((item) => item.day === day),
            );
            return (
              <section className="runTemplatePreviewSection" key={day}>
                <h3>{day}テンプレート</h3>
                <div className="runTemplatePreviewTimeline">
                  {rows.map((item) => (
                    <div className={`runTemplatePreviewRow ${day === "前日" ? "eve" : "day"}`} key={item.id}>
                      <strong className="previewTime">{item.time}</strong>
                      <b>{item.title}</b>
                      <span className={`previewOwnerKind ${ownerKindClass(getRunScheduleOwnerKind(item))}`}>
                        {getRunScheduleOwnerKind(item)}
                      </span>
                      <small>{item.owner}</small>
                      <small>{item.place || "場所未設定"}</small>
                      <small>{item.note || "メモ"}</small>
                    </div>
                  ))}
                  {rows.length === 0 && <div className="runTemplatePreviewEmpty">予定はありません</div>}
                </div>
              </section>
            );
          })}
        </div>
        <div className="templateFooter previewFooter">
          <button className="secondaryButton" onClick={() => setIsRunTemplatePreviewOpen(false)} type="button">
            戻る
          </button>
          <button className="primaryButton" onClick={confirmRunTemplateApply} type="button">
            決定
          </button>
        </div>
      </aside>
    )}
    </>
  );
}

function DatePickerField({
  label,
  value,
  onChange,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
  hideLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div className="datePickerField" ref={rootRef}>
      {!hideLabel && <span>{label}</span>}
      <button className="datePickerButton" onClick={() => setOpen((current) => !current)} type="button">
        <b>{formatDate(value)}</b>
        <CalendarDays size={15} />
      </button>
      {open && (
        <MiniDatePicker
          selectedDate={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function MiniDatePicker({
  selectedDate,
  onSelect,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(firstDayOfMonth(selectedDate));

  useEffect(() => {
    setVisibleMonth(firstDayOfMonth(selectedDate));
  }, [selectedDate]);

  const anchor = toDate(visibleMonth);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeksInGrid = Math.max(5, Math.ceil((startOffset + daysInMonth) / 7));
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells = Array.from({ length: weeksInGrid * 7 }, (_, index) => {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    const date = toIsoDate(cellDate);
    return {
      date,
      inMonth: cellDate.getFullYear() === year && cellDate.getMonth() === month,
      dayOfWeek: cellDate.getDay(),
    };
  });

  const moveMonth = (offset: number) => {
    setVisibleMonth(toIsoDate(new Date(year, month + offset, 1)));
  };

  return (
    <div className="miniDatePicker">
      <div className="miniDateHead">
        <strong>
          {year}/{month + 1}
        </strong>
        <div>
          <button aria-label="前月" onClick={() => moveMonth(-1)} type="button">
            <ChevronLeft size={14} />
          </button>
          <button aria-label="翌月" onClick={() => moveMonth(1)} type="button">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="miniDateWeekdays">
        {["日", "月", "火", "水", "木", "金", "土"].map((day, index) => (
          <span className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""} key={day}>
            {day}
          </span>
        ))}
      </div>
      <div className="miniDateGrid">
        {cells.map((cell) => (
          <button
            className={`${cell.inMonth ? "" : "otherMonth"} ${
              cell.date === selectedDate ? "selected" : ""
            } ${cell.date === toIsoDate(today) ? "today" : ""} ${
              cell.dayOfWeek === 0 ? "sunday" : cell.dayOfWeek === 6 ? "saturday" : ""
            }`}
            key={cell.date}
            onClick={() => onSelect(cell.date)}
            type="button"
          >
            {toDate(cell.date).getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}

function CalendarPanel({
  items,
  anchorDate,
  selectedMarkerDate,
  selectedMarkerLabel,
  onSelectDate,
  onMoveTask,
  onSelectItem,
}: {
  items: CalendarItem[];
  anchorDate: string;
  selectedMarkerDate: string;
  selectedMarkerLabel: string;
  onSelectDate: (date: string) => void;
  onMoveTask: (liveId: string, taskId: string, date: string) => void;
  onSelectItem: (item: CalendarItem) => void;
}) {
  const safeAnchorDate = isIsoDate(anchorDate) ? anchorDate : toIsoDate(today);
  const [selectedDate, setSelectedDate] = useState(safeAnchorDate);
  const [visibleMonth, setVisibleMonth] = useState(firstDayOfMonth(safeAnchorDate));
  const [dragTask, setDragTask] = useState<DragTask | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);
  const [agendaScrollHint, setAgendaScrollHint] = useState({ top: false, bottom: false });
  const agendaListRef = useRef<HTMLDivElement | null>(null);
  const monthSwitchRef = useRef(0);
  useEffect(() => {
    setVisibleMonth(firstDayOfMonth(safeAnchorDate));
    setSelectedDate(safeAnchorDate);
  }, [safeAnchorDate]);

  const anchor = toDate(isIsoDate(visibleMonth) ? visibleMonth : firstDayOfMonth(safeAnchorDate));
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeksInGrid = Math.max(5, Math.ceil((startOffset + daysInMonth) / 7));
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells = Array.from({ length: weeksInGrid * 7 }, (_, index) => {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    const date = toIsoDate(cellDate);
    return {
      key: date,
      date,
      inMonth: cellDate.getFullYear() === year && cellDate.getMonth() === month,
    };
  });
  const monthItems = items.filter((item) => {
    const date = toDate(item.date);
    return date.getFullYear() === year && date.getMonth() === month;
  });
  const selectedItems = items
    .filter((item) => item.date === selectedDate)
    .sort((a, b) => `${a.time}${a.title}`.localeCompare(`${b.time}${b.title}`));
  const updateAgendaScrollHint = () => {
    const element = agendaListRef.current;
    if (!element) return;
    const top = element.scrollTop > 4;
    const bottom = element.scrollTop + element.clientHeight < element.scrollHeight - 4;
    setAgendaScrollHint((current) =>
      current.top === top && current.bottom === bottom ? current : { top, bottom },
    );
  };
  useEffect(() => {
    const frame = window.requestAnimationFrame(updateAgendaScrollHint);
    window.addEventListener("resize", updateAgendaScrollHint);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateAgendaScrollHint);
    };
  }, [selectedDate, selectedItems.length, visibleMonth]);
  const moveMonth = (offset: number) => {
    const next = new Date(year, month + offset, 1);
    const nextMonth = toIsoDate(next);
    setVisibleMonth(nextMonth);
    setSelectedDate(nextMonth);
  };
  const moveMonthWhileDragging = (offset: number) => {
    if (!dragTask) return;
    const now = Date.now();
    if (now - monthSwitchRef.current < 650) return;
    monthSwitchRef.current = now;
    moveMonth(offset);
  };
  const dropTaskOnDate = (date: string) => {
    if (!dragTask) return;
    onMoveTask(dragTask.liveId, dragTask.taskId, date);
    setSelectedDate(date);
    setVisibleMonth(firstDayOfMonth(date));
    setDragTask(null);
    setDropDate(null);
  };

  return (
    <div className="calendarPanel">
      <div className="calendarMonth">
        <div className="calendarMonthTitle">
          <div className="calendarLabel">
            <CalendarDays size={18} />
            <h2>カレンダー</h2>
          </div>
          <strong>
            {year}/{month + 1}
          </strong>
          <span>{monthItems.length}件</span>
        </div>
        <div className="calendarMonthNav">
          <button
            aria-label="前月"
            className={dragTask ? "dragMonthNav" : ""}
            onClick={() => moveMonth(-1)}
            onDragEnter={() => moveMonthWhileDragging(-1)}
            onDragOver={(event) => {
              if (!dragTask) return;
              event.preventDefault();
              moveMonthWhileDragging(-1);
            }}
            type="button"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            aria-label="翌月"
            className={dragTask ? "dragMonthNav" : ""}
            onClick={() => moveMonth(1)}
            onDragEnter={() => moveMonthWhileDragging(1)}
            onDragOver={(event) => {
              if (!dragTask) return;
              event.preventDefault();
              moveMonthWhileDragging(1);
            }}
            type="button"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="calendarWeekdays">
        {["日", "月", "火", "水", "木", "金", "土"].map((day, index) => (
          <span className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""} key={day}>
            {day}
          </span>
        ))}
      </div>
      <div className="calendarGrid">
        {cells.map((cell) => {
          const dayItems = items.filter((item) => item.date === cell.date);
          const groups = summarizeCalendarDay(dayItems);
          const hasHoliday = dayItems.some((item) => item.kind === "祝日");
          const isMarkerSelected = Boolean(cell.date && cell.date === selectedMarkerDate);
          const dayOfWeek = toDate(cell.date).getDay();
          return (
            <button
              className={`calendarCell ${cell.date === toIsoDate(today) ? "today" : ""} ${
                dayItems.length > 0 ? "hasEvent" : ""
              } ${cell.date === selectedDate ? "selected" : ""} ${
                isMarkerSelected ? "dueSelected" : ""
              } ${cell.inMonth ? "" : "otherMonth"} ${
                dayOfWeek === 0 ? "sunday" : dayOfWeek === 6 ? "saturday" : ""
              } ${
                hasHoliday ? "holiday" : ""
              } ${
                dragTask && dropDate === cell.date ? "dropTarget" : ""
              }`}
              key={cell.key}
              onClick={() => {
                if (!cell.inMonth) setVisibleMonth(firstDayOfMonth(cell.date));
                setSelectedDate(cell.date);
                onSelectDate(cell.date);
              }}
              onDragLeave={() => setDropDate((current) => (current === cell.date ? null : current))}
              onDragOver={(event) => {
                if (!dragTask) return;
                event.preventDefault();
                setDropDate(cell.date);
              }}
              onDrop={(event) => {
                event.preventDefault();
                dropTaskOnDate(cell.date);
              }}
              type="button"
            >
              <span>{toDate(cell.date).getDate()}</span>
              <div className="calendarMarks">
                {groups.slice(0, 4).map((group) => (
                  <b className={`eventDot ${eventTone(group.kind)}`} key={group.kind}>
                    {shortKind(group.kind)}
                    {group.count > 1 ? group.count : ""}
                  </b>
                ))}
              </div>
              {isMarkerSelected ? (
                <small className="duePick">{selectedMarkerLabel}</small>
              ) : (
                groups.length > 4 && <small>+{groups.length - 4}</small>
              )}
            </button>
          );
        })}
      </div>
      <div className="calendarAgenda">
        <div className="agendaHeader">
          <strong>{formatDate(selectedDate)}</strong>
          <span>{selectedItems.length}件</span>
        </div>
        <div className="agendaListWrap">
          {agendaScrollHint.top && (
            <div className="groupScrollHint groupScrollHintTop">
              <ChevronUp size={14} />
            </div>
          )}
          <div className="agendaList" onScroll={updateAgendaScrollHint} ref={agendaListRef}>
            {selectedItems.map((item) => (
              <button
                className={`agendaItem ${item.taskId ? "linkedTask draggableTask" : ""}`}
                draggable={Boolean(item.taskId)}
                key={item.id}
                onClick={() => onSelectItem(item)}
                onDragEnd={() => {
                  setDragTask(null);
                  setDropDate(null);
                }}
                onDragStart={(event) => {
                  if (!item.taskId || !item.liveId) return;
                  const task = { liveId: item.liveId, taskId: item.taskId, title: item.title };
                  setDragTask(task);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", item.title);
                }}
                type="button"
              >
                <StatusPill value={item.kind} />
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {item.time ? `${item.time} / ` : ""}
                    {item.liveTitle}
                  </span>
                </div>
              </button>
            ))}
            {selectedItems.length === 0 && (
              <div className="agendaEmpty">
                <span>この日の予定はありません</span>
              </div>
            )}
          </div>
          {agendaScrollHint.bottom && (
            <div className="groupScrollHint groupScrollHintBottom">
              <ChevronDown size={14} />
            </div>
          )}
        </div>
      </div>
      <div className="calendarLegend">
        {[
          ["host", "主催"],
          ["battle", "対バン"],
          ["ticket", "チケット"],
          ["holiday", "祝日"],
          ["task", "タスク"],
          ["prep", "ゲネ/撮影"],
        ].map(([className, label]) => (
          <span className={className} key={className}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function summarizeCalendarDay(items: CalendarItem[]) {
  return items.filter((item) => item.kind !== "祝日").reduce<Array<{ kind: string; count: number }>>((groups, item) => {
    const found = groups.find((group) => group.kind === item.kind);
    if (found) {
      found.count += 1;
      return groups;
    }
    return [...groups, { kind: item.kind, count: 1 }];
  }, []);
}

function calendarItemToLiveDraft(item: CalendarItem, groupName: string): Pick<NewLiveForm, "title" | "venue" | "liveType"> {
  const rawTitle = item.title.trim();
  const venueFromCalendar = item.liveTitle && item.liveTitle !== groupName ? item.liveTitle.trim() : "";
  const atIndex = rawTitle.lastIndexOf("@");
  const hasVenueInTitle = atIndex > 0 && atIndex < rawTitle.length - 1;
  const title = hasVenueInTitle ? rawTitle.slice(0, atIndex).trim() : rawTitle;
  const venue = hasVenueInTitle ? rawTitle.slice(atIndex + 1).trim() : venueFromCalendar;

  return {
    title,
    venue,
    liveType: inferLiveTypeFromTitle(title),
  };
}

function isSameCalendarLive(project: LiveProject, item: CalendarItem, groupName: string) {
  if (project.sourceCalendarEventId && project.sourceCalendarEventId === item.id) return true;
  const draft = calendarItemToLiveDraft(item, groupName);
  return (
    project.eventDate === item.date &&
    normalizeSearchText(project.title) === normalizeSearchText(draft.title)
  );
}

function inferLiveTypeFromTitle(title: string): LiveType {
  if (/生誕|birthday/i.test(title)) return "生誕祭";
  if (/ワンマン|単独|one-?man/i.test(title)) return "ワンマン";
  return "定期公演";
}

function inferCalendarLiveKind(title: string) {
  const normalized = title.trim().toLowerCase();
  if (/対バン|対ﾊﾞﾝ|フェス|fes|festival|サーキット|イベント出演|出演/.test(normalized)) return "対バン";
  if (/主催|ワンマン|単独|定期公演|生誕|birthday|anniversary|リリイベ|リリース/.test(normalized)) return "主催";
  return "対バン";
}

function isExternalCalendarLiveItem(item: CalendarItem) {
  return Boolean(item.readonly && item.kind !== "祝日");
}

function normalizeSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function removeGeneratedTemplateTasks(project: LiveProject): LiveProject {
  const tasks = project.tasks.filter((task) => !task.id.startsWith(`${project.id}-task-`));
  return tasks.length === project.tasks.length ? project : { ...project, tasks };
}

function restoreCalendarLiveStatus(project: LiveProject): LiveProject {
  if (project.sourceCalendarEventId && project.status === "完了" && toDate(project.eventDate) >= today) {
    return { ...project, status: "計画" };
  }
  return project;
}

function clearGeneratedDefaultScheduleInfo(project: LiveProject): LiveProject {
  const eventDate = toDate(project.eventDate);
  const generatedTicketLaunch = `${addDays(eventDate, -35)}T20:00`;
  const generatedRehearsal = `${addDays(eventDate, -2)}T13:00 @ 未定`;
  const generatedPhotoShoot = `${addDays(eventDate, -28)}T11:00 @ 未定`;
  const nextProject = {
    ...project,
    ticketLaunch: project.ticketLaunch === generatedTicketLaunch ? "" : project.ticketLaunch,
    rehearsal: project.rehearsal === generatedRehearsal ? "" : project.rehearsal,
    photoShoot: project.photoShoot === generatedPhotoShoot ? "" : project.photoShoot,
  };
  return nextProject;
}

async function loadGoogleCalendarItems(calendarUrl: string, groupName: string): Promise<CalendarItem[]> {
  const generatedItems = await loadGeneratedCalendarItems(groupName);
  if (generatedItems.length > 0) return generatedItems;

  const icsUrls = calendarUrlToIcsUrls(calendarUrl);
  if (icsUrls.length === 0) return [];
  const calendars = await Promise.all(
    icsUrls.map(async (icsUrl) => parseIcsCalendar(await fetchCalendarText(icsUrl), groupName, icsUrl)),
  );
  const minDate = toDate(addDays(today, -180));
  const maxDate = toDate(addDays(today, 540));
  return calendars
    .flat()
    .filter((item) => {
      const date = toDate(item.date);
      return date >= minDate && date <= maxDate;
    })
    .sort((a, b) => `${a.date}${a.time}${a.title}`.localeCompare(`${b.date}${b.time}${b.title}`));
}

async function loadGeneratedCalendarItems(groupName: string): Promise<CalendarItem[]> {
  try {
    const response = await fetch(new URL("calendar-events.json", document.baseURI).toString(), {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as GeneratedCalendarPayload;
    const calendar = payload.calendars?.find((current) => current.group === groupName);
    const groupEvents =
      calendar?.events
        ?.filter((event) => isIsoDate(event.date))
        .map((event) => ({
          id: event.id,
          date: event.date,
          time: event.time,
          title: event.title,
          liveTitle: event.location || groupName,
          kind: inferCalendarLiveKind(event.title),
          readonly: true,
          sourceUrl: event.sourceUrl,
        })) ?? [];
    const holidayEvents =
      payload.holidays
        ?.filter((event) => isIsoDate(event.date))
        .map((event) => ({
          id: `holiday-${event.id}`,
          date: event.date,
          time: event.time,
          title: event.title,
          liveTitle: "休み",
          kind: "祝日",
          readonly: true,
          sourceUrl: event.sourceUrl,
        })) ?? [];
    return [...groupEvents, ...holidayEvents];
  } catch {
    return [];
  }
}

function calendarUrlToIcsUrls(calendarUrl: string) {
  if (calendarUrl.endsWith(".ics")) return [calendarUrl];
  try {
    const url = new URL(calendarUrl);
    const sources = url.searchParams.getAll("src");
    return sources
      .map(normalizeCalendarSource)
      .filter((source): source is string => Boolean(source && !isHolidayCalendarSource(source)))
      .map((source) => `https://calendar.google.com/calendar/ical/${encodeURIComponent(source)}/public/basic.ics`);
  } catch {
    return [];
  }
}

function normalizeCalendarSource(source: string) {
  const decodedSource = decodeURIComponent(source);
  if (decodedSource.includes("@")) return decodedSource;
  try {
    const decodedBase64 = atob(decodedSource);
    return decodedBase64.includes("@") ? decodedBase64 : decodedSource;
  } catch {
    return decodedSource;
  }
}

function isHolidayCalendarSource(source: string) {
  const normalized = source.toLowerCase();
  return normalized.includes("holiday") || normalized.includes("#holiday");
}

async function fetchCalendarText(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Calendar fetch failed: ${response.status}`);
    return await response.text();
  } catch {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Calendar proxy fetch failed: ${response.status}`);
    return await response.text();
  }
}

function parseIcsCalendar(icsText: string, groupName: string, sourceUrl: string): CalendarItem[] {
  const lines = icsText.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: string[][] = [];
  let currentEvent: string[] | null = null;

  lines.forEach((line) => {
    if (line === "BEGIN:VEVENT") {
      currentEvent = [];
      return;
    }
    if (line === "END:VEVENT") {
      if (currentEvent) events.push(currentEvent);
      currentEvent = null;
      return;
    }
    if (currentEvent) currentEvent.push(line);
  });

  return events.flatMap((eventLines) => {
    const summary = getIcsValue(eventLines, "SUMMARY");
    const start = getIcsValue(eventLines, "DTSTART");
    if (!summary || !start) return [];
    const uid = getIcsValue(eventLines, "UID") || `${summary}-${start}`;
    const location = getIcsValue(eventLines, "LOCATION");
    const parsedStart = parseIcsDateTime(start);
    if (!parsedStart) return [];
    const cleanSummary = unescapeIcsText(summary);
    const cleanLocation = location ? unescapeIcsText(location) : "";

    return [
      {
        id: `external-${groupName}-${uid}`,
        date: parsedStart.date,
        time: parsedStart.time,
        title: cleanSummary,
        liveTitle: cleanLocation || groupName,
        kind: inferCalendarLiveKind(cleanSummary),
        readonly: true,
        sourceUrl,
      },
    ];
  });
}

function getIcsValue(lines: string[], name: string) {
  const line = lines.find((currentLine) => currentLine.startsWith(`${name}:`) || currentLine.startsWith(`${name};`));
  return line?.slice(line.indexOf(":") + 1) ?? "";
}

function parseIcsDateTime(value: string) {
  if (/^\d{8}$/.test(value)) {
    return { date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, time: "" };
  }
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!match) return null;
  if (value.endsWith("Z")) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])));
    return {
      date: toIsoDate(date),
      time: `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
    };
  }
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${match[4]}:${match[5]}`,
  };
}

function unescapeIcsText(value: string) {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function shortKind(kind: string) {
  if (kind === "チケット") return "券";
  if (kind === "主催") return "主催";
  if (kind === "対バン") return "対バン";
  if (kind === "ライブ") return "主催";
  if (kind === "タスク") return "タ";
  if (kind === "カレンダー") return "予定";
  if (kind === "祝日") return "";
  if (kind === "ゲネ") return "準";
  if (kind === "撮影") return "準";
  return kind.slice(0, 1);
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="panelTitle">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function InfoList({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="infoList">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function CompactSection({
  action,
  icon,
  title,
  children,
}: {
  action?: ReactNode;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="compactSection">
      <div className="compactTitle">
        {icon}
        <h3>{title}</h3>
        {action && <div className="compactTitleAction">{action}</div>}
      </div>
      <div className="compactList">{children}</div>
    </section>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress" aria-label={`進捗 ${value}%`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function PhaseBadge({ phase }: { phase: Phase }) {
  return <span className="phaseBadge">{phase}</span>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const tone = priority === "必須" ? "danger" : priority === "重要" ? "warn" : "neutral";
  return <span className={`pill ${tone}`}>{priority}</span>;
}

function DueBadge({ date, done }: { date: string; done: boolean }) {
  if (done) {
    return (
      <span className="dueBadge done">
        <Check size={14} />
        完了済み
      </span>
    );
  }

  const days = daysUntil(date);
  let label = formatDate(date);
  if (days < 0) label = `${formatDate(date)} ${Math.abs(days)}日遅れ`;
  if (days === 0) label = "今日";
  if (days > 0 && days <= 3) label = `あと${days}日`;
  return (
    <span className={`dueBadge ${days < 0 ? "danger" : days <= 3 ? "warn" : ""}`}>
      {days < 0 ? <CircleAlert size={14} /> : <Clock3 size={14} />}
      {label}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  const tone =
    value === "募集中"
      ? "recruiting"
      : value === "応募済み"
        ? "applied"
      : value === "確定" || value === "有効"
          ? "confirmed"
    : value === "遅延" || value === "未依頼" || value === "未作成" || value === "未入力" || value === "停止"
      ? "danger"
      : value === "祝日"
        ? "danger"
      : value === "注意" || value === "制作中" || value === "確認待ち" || value === "作成中" || value === "確認中" || value === "承認待ち"
        ? "warn"
        : value === "完了" || value === "納品済" || value === "入稿済" || value === "公開済"
          ? "ok"
          : "blue";
  return <span className={`pill ${tone}`}>{value}</span>;
}

function ticketStatus(ticket: TicketPlan): TicketStatus {
  return ticket.status ?? (ticket.pageUrl ? "公開済" : "未作成");
}

function createManagerIssues(projects: LiveProject[]): ManagerIssue[] {
  return projects
    .filter((project) => project.status !== "完了")
    .flatMap((project) => {
      const taskIssues = project.tasks.flatMap((task) => {
        if (task.status === "完了") return [];
        const days = daysUntil(task.dueDate);
        const tags: ManagerFilter[] = [];
        let kind: ManagerIssueKind | null = null;
        let detail = "";
        let priority = 0;

        if (days < 0) {
          tags.push("遅延");
          kind = "遅延";
          detail = `${Math.abs(days)}日遅れ`;
          priority += 100 + Math.abs(days);
        } else if (days === 0) {
          tags.push("今日");
          kind = "今日";
          detail = "今日締切";
          priority += 80;
        } else if (days <= 3) {
          tags.push("3日以内");
          kind = "3日以内";
          detail = `あと${days}日`;
          priority += 60 - days;
        }

        if (task.owner === "外注") {
          tags.push("外注");
          kind ??= "外注";
          detail ||= "外注対応中";
          priority += 12;
        }

        if (!kind) return [];

        return [
          {
            id: `${project.id}-${task.id}`,
            kind,
            tags,
            group: project.group,
            liveId: project.id,
            liveTitle: project.title,
            taskId: task.id,
            owner: task.owner,
            title: task.title,
            detail,
            date: task.dueDate,
            priority,
          },
        ];
      });

      const ticketIssues = project.tickets.flatMap((ticket) => {
        const saleDays = daysUntil(ticket.saleStart);
        const status = ticketStatus(ticket);
        if (ticket.pageUrl || status === "公開済" || saleDays > 3) return [];
        const tags: ManagerFilter[] = saleDays < 0 ? ["遅延"] : saleDays === 0 ? ["今日"] : ["3日以内"];
        return [
          {
            id: `${project.id}-${ticket.id}-url`,
            kind: "未入力" as ManagerIssueKind,
            tags,
            group: project.group,
            liveId: project.id,
            liveTitle: project.title,
            owner: project.manager,
            title: `${ticket.name} チケットURL未入力`,
            detail: saleDays < 0 ? `発売日から${Math.abs(saleDays)}日経過` : `発売まであと${saleDays}日`,
            date: ticket.saleStart,
            ticketId: ticket.id,
            priority: saleDays < 0 ? 95 + Math.abs(saleDays) : 55 - saleDays,
          },
        ];
      });

      const productionIssues = project.productionItems.flatMap((item) => {
        if (item.status === "納品済") return [];
        const tags: ManagerFilter[] = [];
        let kind: ManagerIssueKind | null = null;
        let detail = "";
        let priority = 0;
        const external = item.vendor !== "社内" && item.vendor !== "未設定";

        if (isProductionLate(item)) {
          tags.push("遅延");
          kind = "遅延";
          detail = `${Math.abs(daysUntil(item.dueDate))}日遅れ`;
          priority += 100 + Math.abs(daysUntil(item.dueDate));
        }

        if (item.status === "確認待ち") {
          tags.push("確認待ち");
          kind ??= "確認待ち";
          detail ||= "確認待ち";
          priority += 45;
        }

        if (item.status === "未依頼") {
          tags.push("未依頼");
          kind ??= "未依頼";
          detail ||= "制作物が未依頼";
          priority += 50;
        }

        if (external || item.owner === "外注") {
          tags.push("外注");
          kind ??= "外注";
          detail ||= `${item.vendor}で進行中`;
          priority += 12;
        }

        if (!kind) return [];

        return [
          {
            id: `${project.id}-${item.id}`,
            kind,
            tags,
            group: project.group,
            liveId: project.id,
            liveTitle: project.title,
            owner: item.owner,
            title: item.name,
            detail,
            date: item.dueDate,
            productionItemId: item.id,
            priority,
          },
        ];
      });

      return [...taskIssues, ...ticketIssues, ...productionIssues];
    })
    .sort((a, b) => b.priority - a.priority || (a.date ?? "").localeCompare(b.date ?? ""));
}

function managerToneClass(value: ManagerFilter | ManagerIssueKind) {
  if (value === "遅延") return "tone-late";
  if (value === "今日") return "tone-today";
  if (value === "3日以内") return "tone-soon";
  if (value === "外注") return "tone-external";
  if (value === "確認待ち") return "tone-confirm";
  if (value === "未依頼") return "tone-missing";
  if (value === "未入力") return "tone-missing";
  return "tone-all";
}

function isProductionLate(item: ProductionItem) {
  return item.status !== "納品済" && daysUntil(item.dueDate) < 0;
}

function eventTone(kind: string) {
  if (kind === "主催" || kind === "ライブ") return "host";
  if (kind === "対バン") return "battle";
  if (kind === "チケット") return "ticket";
  if (kind === "カレンダー") return "external";
  if (kind === "祝日") return "holiday";
  if (kind === "タスク") return "task";
  return "prep";
}

function defaultRunSchedule(
  projectId: string,
  eventDate: string,
  liveType: LiveType,
  manager: string,
): RunScheduleItem[] {
  const oneManOpening = liveType === "定期公演" ? "18:30" : "16:30";
  const oneManStart = liveType === "定期公演" ? "19:00" : "17:00";
  return [
    {
      id: `${projectId}-schedule-eve-goods`,
      day: "前日",
      time: "18:00",
      title: "グッズ・特典物確認",
      ownerKind: "FOCスタッフ",
      owner: "小杉",
      place: "事務所",
      note: "数量と不足物を確認",
    },
    {
      id: `${projectId}-schedule-eve-costume`,
      day: "前日",
      time: "19:00",
      title: "衣装・撮影物確認",
      ownerKind: "FOCスタッフ",
      owner: "御手洗",
      place: "事務所",
      note: "持ち出し物をまとめる",
    },
    {
      id: `${projectId}-schedule-eve-share`,
      day: "前日",
      time: "20:00",
      title: "集合時間・注意事項共有",
      ownerKind: "FOCスタッフ",
      owner: manager,
      place: "Slack",
      note: "メンバーとスタッフへ共有",
    },
    {
      id: `${projectId}-schedule-day-staff`,
      day: "当日",
      time: "10:00",
      title: "スタッフ集合",
      ownerKind: "FOCスタッフ",
      owner: manager,
      place: "会場入口",
      note: "受付・搬入導線を確認",
    },
    {
      id: `${projectId}-schedule-day-load`,
      day: "当日",
      time: "10:30",
      title: "搬入・受付準備",
      ownerKind: "その他",
      owner: "御手洗",
      place: "会場",
      note: "物販と受付を設営",
    },
    {
      id: `${projectId}-schedule-day-rehearsal`,
      day: "当日",
      time: "13:00",
      title: "リハーサル",
      ownerKind: "出演者",
      owner: manager,
      place: "ステージ",
      note: "音源・立ち位置確認",
    },
    {
      id: `${projectId}-schedule-day-merch`,
      day: "当日",
      time: "15:30",
      title: "物販準備",
      ownerKind: "FOCスタッフ",
      owner: "小杉",
      place: "物販卓",
      note: "価格表と決済確認",
    },
    {
      id: `${projectId}-schedule-day-open`,
      day: "当日",
      time: oneManOpening,
      title: "開場",
      ownerKind: "会場スタッフ",
      owner: manager,
      place: "入口",
      note: "",
    },
    {
      id: `${projectId}-schedule-day-start`,
      day: "当日",
      time: oneManStart,
      title: "開演",
      ownerKind: "出演者",
      owner: manager,
      place: "ステージ",
      note: "",
    },
    {
      id: `${projectId}-schedule-day-benefit`,
      day: "当日",
      time: "19:00",
      title: "特典会",
      ownerKind: "チェキスタッフ",
      owner: "御手洗",
      place: "特典会エリア",
      note: "列整理と撮影導線を確認",
    },
    {
      id: `${projectId}-schedule-day-close`,
      day: "当日",
      time: "20:30",
      title: "撤収",
      ownerKind: "その他",
      owner: "御手洗",
      place: "会場",
      note: "忘れ物確認",
    },
  ];
}

function sortRunSchedule(items: RunScheduleItem[]) {
  const dayRank: Record<RunScheduleDay, number> = { 前日: 0, 当日: 1 };
  return [...items].sort((a, b) => dayRank[a.day] - dayRank[b.day] || a.time.localeCompare(b.time));
}

function getRunScheduleOwnerKind(item: Pick<RunScheduleItem, "ownerKind">): RunScheduleOwnerKind {
  if (item.ownerKind === "御社スタッフ") return "その他";
  if (item.ownerKind === "会場") return "会場スタッフ";
  return item.ownerKind ?? "FOCスタッフ";
}

function ownerKindClass(kind: RunScheduleOwnerKind) {
  const classMap: Record<RunScheduleOwnerKind, string> = {
    FOCスタッフ: "ownerKind-foc",
    チェキスタッフ: "ownerKind-cheki",
    出演者: "ownerKind-cast",
    会場スタッフ: "ownerKind-venue",
    その他: "ownerKind-other",
  };
  return classMap[kind];
}

function printRunSchedule(
  project: LiveProject,
  scheduleItems: RunScheduleItem[],
  ownerKindFilter: RunScheduleOwnerFilter = "全て",
) {
  const printWindow = window.open("", "_blank", "width=960,height=720");
  if (!printWindow) return;
  const sortedItems = sortRunSchedule(scheduleItems);
  const printLabel = ownerKindFilter === "全て" ? "全体版" : `${ownerKindFilter}版`;
  const html = `<!doctype html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(project.title)} 進行表 ${escapeHtml(printLabel)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 28px; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          h1 { margin: 0; font-size: 24px; }
          .subtitle { margin-top: 6px; color: #475569; font-size: 14px; font-weight: 800; }
          h2 { margin: 24px 0 8px; font-size: 17px; border-bottom: 2px solid #111827; padding-bottom: 6px; }
          .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 16px; }
          .meta div { border: 1px solid #d8e0ec; border-radius: 8px; padding: 8px; }
          .meta span { display: block; color: #64748b; font-size: 11px; font-weight: 700; }
          .meta strong { display: block; margin-top: 3px; font-size: 13px; }
          table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th { background: #f1f5f9; color: #334155; text-align: left; }
          th, td { border: 1px solid #d8e0ec; padding: 8px; vertical-align: top; }
          td.time { width: 68px; font-weight: 800; }
          td.kind { width: 118px; font-weight: 800; white-space: nowrap; }
          td.kind span { display: inline-block; min-width: 96px; padding: 4px 7px; border: 1px solid #d8e0ec; border-radius: 999px; text-align: center; white-space: nowrap; }
          td.kind .ownerKind-foc { border-color: #99f6e4; background: #ecfdf5; color: #0f766e; }
          td.kind .ownerKind-cheki { border-color: #bfdbfe; background: #eff6ff; color: #2563eb; }
          td.kind .ownerKind-cast { border-color: #ddd6fe; background: #f5f3ff; color: #6d28d9; }
          td.kind .ownerKind-venue { border-color: #bae6fd; background: #f0f9ff; color: #0369a1; }
          td.kind .ownerKind-other { border-color: #e2e8f0; background: #f8fafc; color: #475569; }
          .col-time { width: 56px; }
          .col-title { width: 138px; }
          .col-kind { width: 112px; }
          .col-owner { width: 64px; }
          .col-place { width: 92px; }
          .col-note { width: auto; }
          td.owner { width: 64px; }
          td.place { width: 92px; }
          @media print { body { padding: 18mm; } button { display: none; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(project.title)} 進行表</h1>
        <div class="subtitle">${escapeHtml(printLabel)}</div>
        <div class="meta">
          <div><span>グループ</span><strong>${escapeHtml(project.group)}</strong></div>
          <div><span>開催日</span><strong>${escapeHtml(formatFullDate(project.eventDate))}</strong></div>
          <div><span>会場</span><strong>${escapeHtml(project.venue)}</strong></div>
          <div><span>主担当</span><strong>${escapeHtml(project.manager)}</strong></div>
        </div>
        ${(["前日", "当日"] as RunScheduleDay[])
          .map((day) => renderSchedulePrintSection(day, project.eventDate, sortedItems))
          .join("")}
        <script>window.addEventListener("load", () => setTimeout(() => window.print(), 200));</script>
      </body>
    </html>`;
  printWindow.document.write(html);
  printWindow.document.close();
}

function renderSchedulePrintSection(day: RunScheduleDay, eventDate: string, scheduleItems: RunScheduleItem[]) {
  const date = day === "前日" ? addDays(toDate(eventDate), -1) : eventDate;
  const rows = scheduleItems.filter((item) => item.day === day);
  return `
    <h2>${escapeHtml(day)} ${escapeHtml(formatFullDate(date))}</h2>
    <table>
      <colgroup>
        <col class="col-time" />
        <col class="col-title" />
        <col class="col-kind" />
        <col class="col-owner" />
        <col class="col-place" />
        <col class="col-note" />
      </colgroup>
      <thead>
        <tr><th>時刻</th><th>内容</th><th>担当区分</th><th>担当</th><th>場所</th><th>メモ</th></tr>
      </thead>
      <tbody>
        ${
          rows.length > 0
            ? rows
                .map(
                  (item) => `<tr>
                    <td class="time">${escapeHtml(item.time)}</td>
                    <td>${escapeHtml(item.title)}</td>
                    <td class="kind"><span class="${escapeHtml(ownerKindClass(getRunScheduleOwnerKind(item)))}">${escapeHtml(
                      getRunScheduleOwnerKind(item),
                    )}</span></td>
                    <td class="owner">${escapeHtml(item.owner)}</td>
                    <td class="place">${escapeHtml(item.place)}</td>
                    <td>${escapeHtml(item.note ?? "")}</td>
                  </tr>`,
                )
                .join("")
            : `<tr><td colspan="6">予定はありません</td></tr>`
        }
      </tbody>
    </table>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAuthRedirectUrl() {
  const explicitUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const basePath = import.meta.env.VITE_BASE_PATH?.trim() || "/idle-task-manager/";
  const normalizedBase = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return `${window.location.origin}${normalizedBase.endsWith("/") ? normalizedBase : `${normalizedBase}/`}`;
}

function consumeLineLinkTokenFromUrl() {
  const currentUrl = new URL(window.location.href);
  const linkToken = currentUrl.searchParams.get("linkToken") ?? currentUrl.searchParams.get("lineLinkToken") ?? "";
  if (linkToken) {
    window.localStorage.setItem(lineLinkTokenStorageKey, linkToken);
    currentUrl.searchParams.delete("linkToken");
    currentUrl.searchParams.delete("lineLinkToken");
    window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    return linkToken;
  }
  return window.localStorage.getItem(lineLinkTokenStorageKey) ?? "";
}

function clearPendingLineLinkToken() {
  window.localStorage.removeItem(lineLinkTokenStorageKey);
}

function generateTasks(projectId: string, eventDate: string, templateItems: TaskTemplateItem[] = []): Task[] {
  const date = toDate(eventDate);
  const items = templateItems;

  return items.map((template, index) => {
    const taskId = `${projectId}-task-${index}`;
    return {
      id: taskId,
      phase: template.phase,
      title: template.title,
      dueDate: addDays(date, template.offset),
      owner: template.owner,
      priority: template.priority,
      status: "未着手",
      memo: template.memo,
      subtasks:
        template.subtasks.length > 0
          ? template.subtasks.map((title, subtaskIndex) => ({
              id: `${taskId}-subtask-${subtaskIndex}`,
              title,
              done: false,
            }))
          : buildSubtasks(taskId, template.title),
    };
  });
}

function applyStatuses(tasks: Task[], statuses: Record<string, TaskStatus>) {
  return tasks.map((task) => updateTaskStatusValue(task, statuses[task.title] ?? task.status));
}

function completeTasks(tasks: Task[]) {
  return tasks.map((task) => updateTaskStatusValue(task, "完了"));
}

function updateDemoTasks(
  tasks: Task[],
  updates: Record<string, Partial<Pick<Task, "status" | "dueDate" | "owner">>>,
) {
  return tasks.map((task) => {
    const update = updates[task.title];
    if (!update) return task;
    return updateTaskStatusValue({ ...task, ...update }, update.status ?? task.status);
  });
}

function publishTickets(tickets: TicketPlan[]) {
  return tickets.map((ticket) => ({
    ...ticket,
    pageUrl: ticket.pageUrl ?? `https://example.com/tickets/${ticket.id}`,
    status: "公開済" as TicketStatus,
  }));
}

function completeProductionItems(items: ProductionItem[]) {
  return items.map((item) => ({
    ...item,
    status: "納品済" as ProductionStatus,
    fileUrl: item.fileUrl ?? `https://example.com/production/${item.id}`,
  }));
}

function buildSubtasks(taskId: string, title: string): SubTask[] | undefined {
  const templates = subtaskTemplates[title];
  if (!templates) return undefined;
  return templates.map((subtaskTitle, index) => ({
    id: `${taskId}-subtask-${index}`,
    title: subtaskTitle,
    done: false,
  }));
}

function updateTaskStatusValue(task: Task, status: TaskStatus): Task {
  return {
    ...task,
    status,
    subtasks:
      status === "完了"
        ? task.subtasks?.map((subtask) => ({ ...subtask, done: true }))
        : task.subtasks,
  };
}

function getSubtaskStats(task: Pick<Task, "subtasks">) {
  const subtasks = task.subtasks ?? [];
  return {
    done: subtasks.filter((subtask) => subtask.done).length,
    total: subtasks.length,
  };
}

function defaultTickets(ticketLaunch: string, liveType: LiveType): TicketPlan[] {
  if (liveType === "ワンマン") {
    return [
      {
        id: `ticket-${crypto.randomUUID()}`,
        name: "VIP",
        price: 12000,
        saleStart: ticketLaunch,
        benefit: "優先入場・限定特典",
        status: "未作成",
      },
      {
        id: `ticket-${crypto.randomUUID()}`,
        name: "一般前売",
        price: 4500,
        saleStart: ticketLaunch,
        benefit: "入場",
        status: "未作成",
      },
      {
        id: `ticket-${crypto.randomUUID()}`,
        name: "当日",
        price: 5000,
        saleStart: ticketLaunch,
        benefit: "入場",
        status: "未作成",
      },
    ];
  }

  return [
    {
      id: `ticket-${crypto.randomUUID()}`,
      name: liveType === "生誕祭" ? "生誕VIP" : "優先",
      price: liveType === "生誕祭" ? 9000 : 7000,
      saleStart: ticketLaunch,
      benefit: "優先入場・限定特典",
      status: "未作成",
    },
    {
      id: `ticket-${crypto.randomUUID()}`,
      name: "一般",
      price: 3500,
      saleStart: ticketLaunch,
      benefit: "入場",
      status: "未作成",
    },
  ];
}

function defaultProductionItems(eventDate: string): ProductionItem[] {
  const date = toDate(eventDate);
  return [
    {
      id: `item-${crypto.randomUUID()}`,
      name: "告知画像",
      owner: "御手洗",
      designer: "",
      vendor: "未設定",
      dueDate: addDays(date, -45),
      status: "未依頼",
      memo: "",
    },
    {
      id: `item-${crypto.randomUUID()}`,
      name: "ブロマイド",
      owner: "鍋島",
      designer: "",
      vendor: "未設定",
      dueDate: addDays(date, -20),
      status: "未依頼",
      memo: "",
    },
    {
      id: `item-${crypto.randomUUID()}`,
      name: "VIP用ピクチャチケット",
      owner: "小杉",
      designer: "",
      vendor: "社内",
      dueDate: addDays(date, -7),
      status: "未依頼",
      memo: "",
    },
  ];
}

function parseQuickTask(text: string, projectEventDate: string) {
  const match = text.match(/^(\d{1,2})\/(\d{1,2})(?:\s+(.+?))(?:\s*@\s*(.+))?$/);
  if (!match) {
    return {
      phase: "イベント" as Phase,
      title: text,
      dueDate: addDays(today, 1),
      owner: "小杉",
      priority: "通常" as Priority,
      memo: "",
    };
  }

  const year = toDate(projectEventDate).getFullYear();
  const month = match[1].padStart(2, "0");
  const day = match[2].padStart(2, "0");
  const title = match[3].trim();
  const place = match[4]?.trim();

  return {
    phase: inferPhase(title),
    title,
    dueDate: `${year}-${month}-${day}`,
    owner: inferOwner(title),
    priority: inferPriority(title),
    memo: place ? `@ ${place}` : "",
  };
}

function inferPhase(title: string): Phase {
  if (title.includes("チケット")) return "チケット";
  if (title.includes("ゲネ") || title.includes("セトリ") || title.includes("カメラマン")) return "企画";
  if (title.includes("画像") || title.includes("グッズ") || title.includes("デザイン")) return "制作物";
  if (title.includes("衣装") || title.includes("撮影") || title.includes("ブロマイド")) return "衣装";
  if (title.includes("VIP") || title.includes("バッテリー") || title.includes("当日")) return "当日";
  return "イベント";
}

function inferOwner(title: string) {
  if (title.includes("画像") || title.includes("グッズ") || title.includes("衣装")) return "外注";
  if (title.includes("セトリ") || title.includes("撮影")) return "鍋島";
  if (title.includes("チケット")) return "小杉";
  return "小杉";
}

function inferPriority(title: string): Priority {
  if (title.includes("会場") || title.includes("チケット") || title.includes("入稿")) return "必須";
  if (title.includes("画像") || title.includes("セトリ") || title.includes("衣装")) return "重要";
  return "通常";
}

function matchesTaskView(task: Task, view: TaskView) {
  if (view === "完了済み") return task.status === "完了";
  return task.status === view;
}

function taskViewFromStatus(status: TaskStatus): TaskView {
  return status === "完了" ? "完了済み" : status;
}

function getTaskRole(task: Pick<Task, "owner" | "phase" | "title">): Exclude<TaskRoleFilter, "全ロール"> {
  if (task.phase === "チケット" || task.title.includes("チケット")) return "チケット";
  if (task.phase === "当日" || task.title.includes("当日") || task.title.includes("バイト")) return "当日運営";
  if (task.owner === "外注") return "制作・外注";
  if (
    task.phase === "制作物" ||
    task.phase === "衣装" ||
    task.title.includes("デザイン") ||
    task.title.includes("画像") ||
    task.title.includes("グッズ") ||
    task.title.includes("ブロマイド") ||
    task.title.includes("衣装")
  ) {
    return "デザイナー";
  }
  return "マネージャー";
}

function completion(tasks: Array<Pick<Task, "status">>) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.status === "完了").length / tasks.length) * 100);
}

function priorityRank(priority: Priority) {
  if (priority === "必須") return 0;
  if (priority === "重要") return 1;
  return 2;
}

function isLate(task: Pick<Task, "dueDate" | "status">) {
  return task.status !== "完了" && toDate(task.dueDate).getTime() < today.getTime();
}

function daysUntil(date: string) {
  return daysBetween(today, toDate(date));
}

function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function firstDayOfMonth(value: string) {
  const date = toDate(value);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function toDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDate(value).getTime());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return toIsoDate(next);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const date = toDate(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatFullDate(value: string) {
  const date = toDate(value);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateTime(value: string) {
  if (!value) return "未設定";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  const time = value.includes("T") ? value.split("T")[1].slice(0, 5) : "";
  return `${date.getMonth() + 1}/${date.getDate()}${time ? ` ${time}` : ""}`;
}

function formatSchedule(value: string) {
  if (!value) return "未設定";
  const date = extractDate(value);
  if (!isIsoDate(date)) return value.trim() || "未設定";
  const time = extractTime(value);
  const place = value.includes("@") ? ` @${value.split("@")[1].trim()}` : "";
  return `${formatDate(date)}${time ? ` ${time}` : ""}${place}`;
}

function toDateTimeLocalInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(0, 16) : "";
}

function extractDate(value: string) {
  return value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? value.slice(0, 10);
}

function extractTime(value: string) {
  return value.includes("T") ? value.split("T")[1].slice(0, 5) : "";
}

export default App;

