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
  Plus,
  Search,
  Sparkles,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type LiveStatus = "計画" | "進行中" | "完了" | "キャンセル";
type TaskStatus = "未着手" | "進行中" | "完了";
type Priority = "必須" | "重要" | "通常";
type Phase = "イベント" | "チケット" | "企画" | "制作物" | "衣装" | "当日";
type LiveType = "ワンマン" | "定期公演" | "生誕祭";
type TaskView = "未着手" | "進行中" | "完了済み";
type LiveListView = "未" | "完";
type TicketStatus = "未作成" | "作成中" | "確認中" | "公開済";
type ProductionStatus = "未依頼" | "依頼済" | "制作中" | "確認待ち" | "入稿済" | "納品済";

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
  vendor: string;
  dueDate: string;
  status: ProductionStatus;
  fileUrl?: string;
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
  tasks: Task[];
  tickets: TicketPlan[];
  productionItems: ProductionItem[];
};

type NewLiveForm = {
  group: string;
  title: string;
  venue: string;
  eventDate: string;
  manager: string;
  liveType: LiveType;
};

type CalendarItem = {
  id: string;
  date: string;
  time: string;
  title: string;
  liveTitle: string;
  kind: string;
  liveId: string;
  taskId?: string;
  taskStatus?: TaskStatus;
};

type DragTask = {
  liveId: string;
  taskId: string;
  title: string;
};

const groupPages = [
  { name: "Elandia", manager: "田中", photo: "https://picsum.photos/seed/elandia/96/96" },
  { name: "Nova Belles", manager: "佐藤", photo: "https://picsum.photos/seed/nova-belles/96/96" },
  { name: "Lumiere", manager: "高橋", photo: "https://picsum.photos/seed/lumiere/96/96" },
  { name: "Asteria", manager: "小林", photo: "https://picsum.photos/seed/asteria/96/96" },
  { name: "Prism Note", manager: "佐藤", photo: "https://picsum.photos/seed/prism-note/96/96" },
  { name: "Mirai Palette", manager: "高橋", photo: "https://picsum.photos/seed/mirai-palette/96/96" },
];

const managers = ["田中", "佐藤", "高橋", "小林", "外注"];
const phaseOrder: Phase[] = ["イベント", "チケット", "企画", "制作物", "衣装", "当日"];
const ticketStatuses: TicketStatus[] = ["未作成", "作成中", "確認中", "公開済"];
const productionStatuses: ProductionStatus[] = ["未依頼", "依頼済", "制作中", "確認待ち", "入稿済", "納品済"];
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
  { phase: "イベント", title: "イベント日決定", offset: -120, owner: "田中", priority: "必須" },
  { phase: "イベント", title: "会場決定＆予約", offset: -110, owner: "田中", priority: "必須" },
  { phase: "イベント", title: "ライブタイトル決定", offset: -75, owner: "佐藤", priority: "重要" },
  {
    phase: "チケット",
    title: "FC・一般スケジュール決定",
    offset: -65,
    owner: "佐藤",
    priority: "必須",
  },
  { phase: "チケット", title: "チケットページ作成", offset: -55, owner: "小林", priority: "必須" },
  { phase: "企画", title: "タイムテーブル作成", offset: -45, owner: "高橋", priority: "重要" },
  { phase: "企画", title: "楽曲制作", offset: -60, owner: "高橋", priority: "重要" },
  { phase: "企画", title: "セトリ", offset: -25, owner: "高橋", priority: "重要" },
  { phase: "企画", title: "ゲネプロスタジオ予約", offset: -35, owner: "田中", priority: "必須" },
  { phase: "企画", title: "当日バイト手配", offset: -18, owner: "小林", priority: "重要" },
  { phase: "企画", title: "当日カメラマン手配", offset: -28, owner: "小林", priority: "重要" },
  {
    phase: "制作物",
    title: "告知画像の依頼",
    offset: -50,
    owner: "外注",
    priority: "重要",
    memo: "素材一式を共有",
  },
  { phase: "制作物", title: "デザイナー制作発注", offset: -45, owner: "外注", priority: "重要" },
  { phase: "制作物", title: "制作物リストの企画", offset: -40, owner: "佐藤", priority: "重要" },
  { phase: "制作物", title: "グッズ入稿", offset: -21, owner: "外注", priority: "必須" },
  {
    phase: "衣装",
    title: "衣装イメージ共有",
    offset: -55,
    owner: "佐藤",
    priority: "重要",
    memo: "制作会社へ方向性共有",
  },
  { phase: "衣装", title: "最終確認", offset: -16, owner: "佐藤", priority: "必須" },
  { phase: "衣装", title: "衣装納品", offset: -10, owner: "外注", priority: "必須" },
  { phase: "衣装", title: "アー写＆ブロマイド撮影", offset: -30, owner: "高橋", priority: "重要" },
  { phase: "当日", title: "VIP用ピクチャチケットを準備", offset: -7, owner: "小林", priority: "通常" },
  {
    phase: "当日",
    title: "ビデオカメラのバッテリー充電＆確認",
    offset: -2,
    owner: "小林",
    priority: "通常",
  },
  { phase: "当日", title: "最前列の紙用意", offset: -2, owner: "小林", priority: "通常" },
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

const initialProjects: LiveProject[] = [
  {
    id: "live-elandia-3rd",
    group: "Elandia",
    title: "3rd Anniversary Live",
    venue: "Spotify O-WEST",
    eventDate: "2026-06-10",
    status: "進行中",
    manager: "田中",
    liveType: "ワンマン",
    ticketLaunch: "2026-05-20T20:00",
    rehearsal: "2026-06-08T14:00 @ 新宿リハーサルスタジオ",
    photoShoot: "2026-05-22T11:00 @ 代々木スタジオ",
    productionCompany: "Blue Stage 制作",
    tasks: applyStatuses(generateTasks("live-elandia-3rd", "2026-06-10"), {
      イベント日決定: "完了",
      "会場決定＆予約": "完了",
      ライブタイトル決定: "完了",
      "FC・一般スケジュール決定": "完了",
      チケットページ作成: "完了",
      タイムテーブル作成: "進行中",
      楽曲制作: "完了",
      セトリ: "進行中",
      ゲネプロスタジオ予約: "完了",
      当日バイト手配: "進行中",
      当日カメラマン手配: "完了",
      告知画像の依頼: "完了",
      デザイナー制作発注: "完了",
      制作物リストの企画: "進行中",
      グッズ入稿: "未着手",
      衣装イメージ共有: "完了",
      最終確認: "進行中",
      "アー写＆ブロマイド撮影": "完了",
    }),
    tickets: [
      {
        id: "ticket-elandia-vip",
        name: "VIP",
        price: 12000,
        saleStart: "2026-05-20T20:00",
        benefit: "優先入場・限定ブロマイド",
      },
      {
        id: "ticket-elandia-general",
        name: "一般前売",
        price: 4500,
        saleStart: "2026-05-21T20:00",
        benefit: "入場",
      },
    ],
    productionItems: [
      {
        id: "item-elandia-keyvisual",
        name: "告知画像",
        owner: "佐藤",
        vendor: "Design Nao",
        dueDate: "2026-05-18",
        status: "納品済",
      },
      {
        id: "item-elandia-bromide",
        name: "ブロマイド",
        owner: "高橋",
        vendor: "Photo K",
        dueDate: "2026-06-04",
        status: "確認待ち",
      },
      {
        id: "item-elandia-shirt",
        name: "記念Tシャツ",
        owner: "外注",
        vendor: "PrintWorks",
        dueDate: "2026-06-03",
        status: "制作中",
      },
    ],
  },
  {
    id: "live-elandia-regular",
    group: "Elandia",
    title: "Monthly Stage vol.18",
    venue: "渋谷Club Asia",
    eventDate: "2026-06-28",
    status: "計画",
    manager: "田中",
    liveType: "定期公演",
    ticketLaunch: "2026-06-12T20:00",
    rehearsal: "2026-06-26T13:00 @ 渋谷サウンドスタジオ",
    photoShoot: "2026-06-18T11:00 @ 原宿スタジオ",
    productionCompany: "ElandCo internal",
    tasks: applyStatuses(generateTasks("live-elandia-regular", "2026-06-28"), {
      イベント日決定: "完了",
      "会場決定＆予約": "完了",
      ライブタイトル決定: "進行中",
      チケットページ作成: "未着手",
    }),
    tickets: defaultTickets("2026-06-12T20:00", "定期公演"),
    productionItems: defaultProductionItems("2026-06-28"),
  },
  {
    id: "live-nova-summer",
    group: "Nova Belles",
    title: "Summer One-man",
    venue: "Zepp Shinjuku",
    eventDate: "2026-07-20",
    status: "進行中",
    manager: "佐藤",
    liveType: "ワンマン",
    ticketLaunch: "2026-06-15T21:00",
    rehearsal: "2026-07-17T12:00 @ 渋谷サウンドスタジオ",
    photoShoot: "2026-06-20T10:00 @ 目黒スタジオ",
    productionCompany: "Orbit Live Works",
    tasks: applyStatuses(generateTasks("live-nova-summer", "2026-07-20"), {
      イベント日決定: "完了",
      "会場決定＆予約": "完了",
      ライブタイトル決定: "完了",
      "FC・一般スケジュール決定": "進行中",
      チケットページ作成: "未着手",
      告知画像の依頼: "進行中",
      衣装イメージ共有: "進行中",
    }),
    tickets: [
      {
        id: "ticket-nova-premium",
        name: "プレミアム",
        price: 15000,
        saleStart: "2026-06-15T21:00",
        benefit: "優先入場・限定グッズ",
      },
      {
        id: "ticket-nova-general",
        name: "一般",
        price: 6000,
        saleStart: "2026-06-16T21:00",
        benefit: "入場",
      },
    ],
    productionItems: [
      {
        id: "item-nova-poster",
        name: "駅貼りポスター",
        owner: "佐藤",
        vendor: "Design Nao",
        dueDate: "2026-06-24",
        status: "依頼済",
      },
      {
        id: "item-nova-towel",
        name: "マフラータオル",
        owner: "外注",
        vendor: "PrintWorks",
        dueDate: "2026-07-01",
        status: "未依頼",
      },
    ],
  },
  {
    id: "live-nova-birthday",
    group: "Nova Belles",
    title: "Mio Birthday Live",
    venue: "新宿BLAZE",
    eventDate: "2026-08-08",
    status: "計画",
    manager: "佐藤",
    liveType: "生誕祭",
    ticketLaunch: "2026-07-10T21:00",
    rehearsal: "2026-08-06T15:00 @ 新宿リハーサルスタジオ",
    photoShoot: "2026-07-13T10:00 @ 目黒スタジオ",
    productionCompany: "Orbit Live Works",
    tasks: applyStatuses(generateTasks("live-nova-birthday", "2026-08-08"), {
      イベント日決定: "完了",
      "会場決定＆予約": "完了",
      ライブタイトル決定: "未着手",
    }),
    tickets: defaultTickets("2026-07-10T21:00", "生誕祭"),
    productionItems: defaultProductionItems("2026-08-08"),
  },
  {
    id: "live-lumiere-regular",
    group: "Lumiere",
    title: "定期公演 vol.12",
    venue: "新宿ReNY",
    eventDate: "2026-06-15",
    status: "計画",
    manager: "高橋",
    liveType: "定期公演",
    ticketLaunch: "2026-06-05T20:00",
    rehearsal: "2026-06-13T13:00 @ 池袋リハーサルベース",
    photoShoot: "2026-06-07T12:00 @ 原宿スタジオ",
    productionCompany: "ElandCo internal",
    tasks: applyStatuses(generateTasks("live-lumiere-regular", "2026-06-15"), {
      イベント日決定: "完了",
      "会場決定＆予約": "完了",
      ライブタイトル決定: "進行中",
      "FC・一般スケジュール決定": "未着手",
      チケットページ作成: "未着手",
    }),
    tickets: [
      {
        id: "ticket-lumiere-priority",
        name: "優先",
        price: 7000,
        saleStart: "2026-06-05T20:00",
        benefit: "優先入場・限定ステッカー",
      },
      {
        id: "ticket-lumiere-general",
        name: "一般",
        price: 3500,
        saleStart: "2026-06-06T20:00",
        benefit: "入場",
      },
    ],
    productionItems: [
      {
        id: "item-lumiere-sticker",
        name: "限定ステッカー",
        owner: "小林",
        vendor: "QuickPrint",
        dueDate: "2026-06-10",
        status: "未依頼",
      },
    ],
  },
  {
    id: "live-lumiere-summer",
    group: "Lumiere",
    title: "Summer Showcase",
    venue: "白金高輪SELENE b2",
    eventDate: "2026-07-05",
    status: "進行中",
    manager: "高橋",
    liveType: "ワンマン",
    ticketLaunch: "2026-06-09T20:00",
    rehearsal: "2026-07-03T13:00 @ 池袋リハーサルベース",
    photoShoot: "2026-06-14T12:00 @ 原宿スタジオ",
    productionCompany: "ElandCo internal",
    tasks: applyStatuses(generateTasks("live-lumiere-summer", "2026-07-05"), {
      イベント日決定: "完了",
      "会場決定＆予約": "完了",
      ライブタイトル決定: "完了",
      "FC・一般スケジュール決定": "進行中",
    }),
    tickets: defaultTickets("2026-06-09T20:00", "ワンマン"),
    productionItems: defaultProductionItems("2026-07-05"),
  },
  {
    id: "live-asteria-debut",
    group: "Asteria",
    title: "Debut Showcase",
    venue: "代官山UNIT",
    eventDate: "2026-06-22",
    status: "進行中",
    manager: "小林",
    liveType: "ワンマン",
    ticketLaunch: "2026-06-07T20:00",
    rehearsal: "2026-06-20T13:00 @ 恵比寿スタジオ",
    photoShoot: "2026-06-10T11:00 @ 中目黒スタジオ",
    productionCompany: "First Line Production",
    tasks: applyStatuses(generateTasks("live-asteria-debut", "2026-06-22"), {
      イベント日決定: "完了",
      "会場決定＆予約": "完了",
      ライブタイトル決定: "完了",
      チケットページ作成: "進行中",
    }),
    tickets: defaultTickets("2026-06-07T20:00", "ワンマン"),
    productionItems: defaultProductionItems("2026-06-22"),
  },
  {
    id: "live-asteria-vol2",
    group: "Asteria",
    title: "Star Trail vol.2",
    venue: "下北沢シャングリラ",
    eventDate: "2026-07-18",
    status: "計画",
    manager: "小林",
    liveType: "定期公演",
    ticketLaunch: "2026-07-01T20:00",
    rehearsal: "2026-07-16T14:00 @ 下北沢スタジオ",
    photoShoot: "2026-06-24T12:00 @ 代々木スタジオ",
    productionCompany: "First Line Production",
    tasks: applyStatuses(generateTasks("live-asteria-vol2", "2026-07-18"), {
      イベント日決定: "完了",
      "会場決定＆予約": "進行中",
    }),
    tickets: defaultTickets("2026-07-01T20:00", "定期公演"),
    productionItems: defaultProductionItems("2026-07-18"),
  },
  {
    id: "live-prism-note-release",
    group: "Prism Note",
    title: "New Single Release Live",
    venue: "Veats Shibuya",
    eventDate: "2026-07-12",
    status: "進行中",
    manager: "佐藤",
    liveType: "ワンマン",
    ticketLaunch: "2026-06-18T21:00",
    rehearsal: "2026-07-10T13:00 @ 渋谷サウンドスタジオ",
    photoShoot: "2026-06-21T10:00 @ 目黒スタジオ",
    productionCompany: "Sound Arc",
    tasks: applyStatuses(generateTasks("live-prism-note-release", "2026-07-12"), {
      イベント日決定: "完了",
      "会場決定＆予約": "完了",
      告知画像の依頼: "進行中",
    }),
    tickets: defaultTickets("2026-06-18T21:00", "ワンマン"),
    productionItems: defaultProductionItems("2026-07-12"),
  },
  {
    id: "live-prism-note-regular",
    group: "Prism Note",
    title: "Prism Room vol.7",
    venue: "GARRET udagawa",
    eventDate: "2026-08-02",
    status: "計画",
    manager: "佐藤",
    liveType: "定期公演",
    ticketLaunch: "2026-07-15T20:00",
    rehearsal: "2026-07-31T14:00 @ 渋谷リハーサル",
    photoShoot: "2026-07-08T12:00 @ 原宿スタジオ",
    productionCompany: "Sound Arc",
    tasks: applyStatuses(generateTasks("live-prism-note-regular", "2026-08-02"), {
      イベント日決定: "完了",
    }),
    tickets: defaultTickets("2026-07-15T20:00", "定期公演"),
    productionItems: defaultProductionItems("2026-08-02"),
  },
  {
    id: "live-mirai-palette-first",
    group: "Mirai Palette",
    title: "First Color Live",
    venue: "恵比寿LIQUIDROOM",
    eventDate: "2026-06-30",
    status: "進行中",
    manager: "高橋",
    liveType: "ワンマン",
    ticketLaunch: "2026-06-11T21:00",
    rehearsal: "2026-06-28T13:00 @ 恵比寿スタジオ",
    photoShoot: "2026-06-16T10:00 @ 代々木スタジオ",
    productionCompany: "Palette Works",
    tasks: applyStatuses(generateTasks("live-mirai-palette-first", "2026-06-30"), {
      イベント日決定: "完了",
      "会場決定＆予約": "完了",
      ライブタイトル決定: "完了",
      "FC・一般スケジュール決定": "進行中",
    }),
    tickets: defaultTickets("2026-06-11T21:00", "ワンマン"),
    productionItems: defaultProductionItems("2026-06-30"),
  },
  {
    id: "live-mirai-palette-regular",
    group: "Mirai Palette",
    title: "Palette Lab vol.3",
    venue: "新宿MARZ",
    eventDate: "2026-07-26",
    status: "計画",
    manager: "高橋",
    liveType: "定期公演",
    ticketLaunch: "2026-07-09T20:00",
    rehearsal: "2026-07-24T14:00 @ 新宿スタジオ",
    photoShoot: "2026-07-02T11:00 @ 目黒スタジオ",
    productionCompany: "Palette Works",
    tasks: applyStatuses(generateTasks("live-mirai-palette-regular", "2026-07-26"), {
      イベント日決定: "完了",
      "会場決定＆予約": "進行中",
    }),
    tickets: defaultTickets("2026-07-09T20:00", "定期公演"),
    productionItems: defaultProductionItems("2026-07-26"),
  },
];

function App() {
  const [projects, setProjects] = useState(initialProjects);
  const [activeGroup, setActiveGroup] = useState(groupPages[0].name);
  const [selectedLiveId, setSelectedLiveId] = useState(initialProjects[0].id);
  const [taskView, setTaskView] = useState<TaskView>("未着手");
  const [liveListView, setLiveListView] = useState<LiveListView>("未");
  const [query, setQuery] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskOwner, setNewTaskOwner] = useState(selectedLiveId ? "田中" : managers[0]);
  const [taskOwnerFilter, setTaskOwnerFilter] = useState("全員");
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);
  const [taskScrollHint, setTaskScrollHint] = useState({ top: false, bottom: false });
  const [actionScrollHint, setActionScrollHint] = useState({ top: false, bottom: false });
  const taskListRef = useRef<HTMLDivElement | null>(null);
  const actionColumnRef = useRef<HTMLElement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newLive, setNewLive] = useState<NewLiveForm>({
    group: groupPages[0].name,
    title: "",
    venue: "",
    eventDate: "",
    manager: groupPages[0].manager,
    liveType: "ワンマン",
  });

  const groupProjects = useMemo(
    () =>
      projects
        .filter((project) => project.group === activeGroup)
        .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()),
    [activeGroup, projects],
  );

  const calendarItems = groupProjects
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
          kind: "ライブ",
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

      return [...milestoneItems, ...taskItems];
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const liveListProjects = groupProjects.filter((project) =>
    liveListView === "完" ? project.status === "完了" : project.status !== "完了",
  );
  const liveListCounts: Record<LiveListView, number> = {
    未: groupProjects.filter((project) => project.status !== "完了").length,
    完: groupProjects.filter((project) => project.status === "完了").length,
  };
  const selectedLive =
    groupProjects.find((project) => project.id === selectedLiveId) ?? groupProjects[0] ?? projects[0];

  const searchedProjects = liveListProjects.filter((project) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return `${project.title} ${project.venue}`.toLowerCase().includes(text);
  });

  const groupTasks = groupProjects.flatMap((project) => project.tasks);
  const liveTasks = selectedLive.tasks.map((task) => ({
    ...task,
    liveId: selectedLive.id,
    liveTitle: selectedLive.title,
    eventDate: selectedLive.eventDate,
  }));
  const ownerFilteredTasks =
    taskOwnerFilter === "全員" ? liveTasks : liveTasks.filter((task) => task.owner === taskOwnerFilter);
  const ownerFilterOptions = ["全員", ...managers.filter((manager) => liveTasks.some((task) => task.owner === manager))];

  const visibleTasks = ownerFilteredTasks
    .filter((task) => matchesTaskView(task, taskView))
    .sort((a, b) => {
      const lateSort = Number(isLate(b)) - Number(isLate(a));
      if (lateSort !== 0) return lateSort;
      const prioritySort = priorityRank(a.priority) - priorityRank(b.priority);
      if (prioritySort !== 0) return prioritySort;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const taskCounts: Record<TaskView, number> = {
    未着手: ownerFilteredTasks.filter((task) => matchesTaskView(task, "未着手")).length,
    進行中: ownerFilteredTasks.filter((task) => matchesTaskView(task, "進行中")).length,
    完了済み: ownerFilteredTasks.filter((task) => matchesTaskView(task, "完了済み")).length,
  };

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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      updateTaskScrollHint();
      updateActionScrollHint();
    });
    const updateScrollHints = () => {
      updateTaskScrollHint();
      updateActionScrollHint();
    };
    window.addEventListener("resize", updateScrollHints);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateScrollHints);
    };
  }, [selectedLiveId, taskView, taskOwnerFilter, visibleTasks.length]);

  useEffect(() => {
    if (liveListProjects.length === 0) return;
    if (!liveListProjects.some((project) => project.id === selectedLiveId)) {
      setSelectedLiveId(liveListProjects[0].id);
      setTaskOwnerFilter("全員");
      setSelectedTaskKey(null);
    }
  }, [liveListProjects, selectedLiveId]);

  function selectGroup(groupName: string) {
    const nextProject = projects
      .filter((project) => project.group === groupName && project.status !== "完了")
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];
    const fallbackProject = projects
      .filter((project) => project.group === groupName)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];
    const nextProfile = groupPages.find((group) => group.name === groupName) ?? groupPages[0];

    setActiveGroup(groupName);
    setLiveListView("未");
    if (nextProject ?? fallbackProject) setSelectedLiveId((nextProject ?? fallbackProject).id);
    setTaskView("未着手");
    setTaskOwnerFilter("全員");
    setQuery("");
    setNewLive((form) => ({
      ...form,
      group: groupName,
      manager: nextProfile.manager,
    }));
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

  function updateTicket(projectId: string, ticketId: string, updates: Partial<TicketPlan>) {
    updateProject(projectId, (project) => ({
      ...project,
      tickets: project.tickets.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, ...updates } : ticket,
      ),
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

  function moveTaskDueDate(projectId: string, taskId: string, dueDate: string) {
    const targetTask = projects.find((project) => project.id === projectId)?.tasks.find((task) => task.id === taskId);
    updateProject(projectId, (project) => ({
      ...project,
      tasks: project.tasks.map((task) => (task.id === taskId ? { ...task, dueDate } : task)),
    }));
    setSelectedLiveId(projectId);
    setSelectedTaskKey(`${projectId}-${taskId}`);
    if (targetTask) setTaskView(taskViewFromStatus(targetTask.status));
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

  function createLive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newLive.title.trim() || !newLive.venue.trim() || !newLive.eventDate) return;

    const id = `live-${crypto.randomUUID()}`;
    const ticketLaunch = `${addDays(toDate(newLive.eventDate), -35)}T20:00`;
    const live: LiveProject = {
      id,
      group: activeGroup,
      title: newLive.title.trim(),
      venue: newLive.venue.trim(),
      eventDate: newLive.eventDate,
      status: "計画",
      manager: newLive.manager,
      liveType: newLive.liveType,
      ticketLaunch,
      rehearsal: `${addDays(toDate(newLive.eventDate), -2)}T13:00 @ 未定`,
      photoShoot: `${addDays(toDate(newLive.eventDate), -28)}T11:00 @ 未定`,
      productionCompany: "未設定",
      tasks: generateTasks(id, newLive.eventDate),
      tickets: defaultTickets(ticketLaunch, newLive.liveType),
      productionItems: defaultProductionItems(newLive.eventDate),
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

  return (
    <div className="app">
      <header className="topBar">
        <div className="brand">
          <div className="brandMark">
            <Sparkles size={21} />
          </div>
          <div>
            <span>Live task manager</span>
            <h1>グループ別ライブ管理</h1>
          </div>
        </div>
      </header>

      <main className="groupPage">
        <section className="workGrid">
          <aside className="liveRail">
            <section className="sidePanel">
              <PanelTitle icon={<Sparkles size={18} />} title="グループ" />
              <GroupList
                activeGroup={activeGroup}
                groups={groupPages}
                projects={projects}
                onSelect={selectGroup}
              />
            </section>

            <section className="sidePanel">
              <div className="panelTitle panelTitleAction">
                <div>
                  <CalendarDays size={18} />
                  <h2>ライブ一覧</h2>
                </div>
                <button
                  className="miniAddButton"
                  onClick={() => {
                    const profile = groupPages.find((group) => group.name === activeGroup);
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
              <div className="liveList">
                {searchedProjects.map((project) => (
                  <LiveCard
                    key={project.id}
                    project={project}
                    selected={project.id === selectedLive.id}
                    onSelect={() => {
                      setSelectedLiveId(project.id);
                      setTaskOwnerFilter("全員");
                    }}
                  />
                ))}
                {searchedProjects.length === 0 && (
                  <div className="miniEmpty">表示するライブはありません</div>
                )}
              </div>
            </section>
          </aside>

          <aside className="calendarColumn">
            <section className="sidePanel">
              <CalendarPanel
                items={calendarItems}
                anchorDate={selectedLive.eventDate}
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
                  setSelectedLiveId(item.liveId);
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
                <div className="panelHead">
                  <div>
                    <h2>タスク</h2>
                  </div>
                  <div className="taskControls">
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
                      onSubtaskToggle={(subtaskId) => toggleSubtask(task.liveId, task.id, subtaskId)}
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
                  <LiveSummary
                    project={selectedLive}
                    onLiveStatusChange={(status) => setLiveStatus(selectedLive.id, status)}
                    onTicketChange={(ticketId, updates) => updateTicket(selectedLive.id, ticketId, updates)}
                    onProductionItemChange={(itemId, updates) =>
                      updateProductionItem(selectedLive.id, itemId, updates)
                    }
                  />
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
                      {managers
                        .filter((manager) => manager !== "外注")
                        .map((manager) => (
                          <option key={manager}>{manager}</option>
                        ))}
                    </select>
                  </label>
                </div>
                <button className="primaryButton full" type="submit">
                  <CopyPlus size={18} />
                  作成
                </button>
              </form>
              </aside>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

function GroupList({
  activeGroup,
  groups,
  projects,
  onSelect,
}: {
  activeGroup: string;
  groups: typeof groupPages;
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
              <img alt="" className="groupPhoto" src={group.photo} />
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

function TaskRow({
  task,
  selected,
  onSelectLive,
  onToggle,
  onStatusChange,
  onSubtaskToggle,
}: {
  task: Task & { liveId: string; liveTitle: string; eventDate: string };
  selected: boolean;
  onSelectLive: () => void;
  onToggle: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onSubtaskToggle: (subtaskId: string) => void;
}) {
  const subtaskStats = getSubtaskStats(task);
  const hasSubtasks = Boolean(task.subtasks?.length);

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
      <button className="taskBody" onClick={onSelectLive} type="button">
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
      </div>
      {selected && hasSubtasks && (
        <div className="subtaskPanel">
          {task.subtasks?.map((subtask) => (
            <button
              className={subtask.done ? "done" : ""}
              key={subtask.id}
              onClick={() => onSubtaskToggle(subtask.id)}
              type="button"
            >
              <span>{subtask.done && <Check size={13} />}</span>
              <b>{subtask.title}</b>
            </button>
          ))}
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
  return (
    <button className={`liveCard ${selected ? "selected" : ""}`} onClick={onSelect} type="button">
      <div>
        <strong>{project.title}</strong>
        <span>@{project.venue}</span>
      </div>
      <div className="liveCardMeta">
        <StatusPill value={project.status === "完了" ? "完了" : late > 0 ? "遅延" : project.status} />
        <b>{formatDate(project.eventDate)}</b>
      </div>
      <ProgressBar value={completion(project.tasks)} />
    </button>
  );
}

function LiveSummary({
  project,
  onLiveStatusChange,
  onTicketChange,
  onProductionItemChange,
}: {
  project: LiveProject;
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

      <TicketManager tickets={project.tickets} onTicketChange={onTicketChange} />

      <ProductionManager items={project.productionItems} onProductionItemChange={onProductionItemChange} />
    </div>
  );
}

function TicketManager({
  tickets,
  onTicketChange,
}: {
  tickets: TicketPlan[];
  onTicketChange: (ticketId: string, updates: Partial<TicketPlan>) => void;
}) {
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);

  useEffect(() => {
    if (selectedTicketId && !tickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId("");
    }
  }, [selectedTicketId, tickets]);

  return (
    <CompactSection icon={<Ticket size={17} />} title="チケット">
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
                <TicketEditor ticket={ticket} onTicketChange={onTicketChange} />
              )}
            </div>
          );
        })}
      </div>
    </CompactSection>
  );
}

function TicketEditor({
  ticket,
  onTicketChange,
}: {
  ticket: TicketPlan;
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
    </div>
  );
}

function ProductionManager({
  items,
  onProductionItemChange,
}: {
  items: ProductionItem[];
  onProductionItemChange: (itemId: string, updates: Partial<ProductionItem>) => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const selectedItem = items.find((item) => item.id === selectedItemId);

  useEffect(() => {
    if (selectedItemId && !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId("");
    }
  }, [items, selectedItemId]);

  return (
    <CompactSection icon={<PackageCheck size={17} />} title="制作物">
      <div className="productionRows">
        {items.map((item) => {
          const isSelected = selectedItem?.id === item.id;
          const late = isProductionLate(item);
          return (
            <div className="productionEntry" key={item.id}>
              <button
                className={`productionRow ${isSelected ? "active" : ""} ${late ? "late" : ""}`}
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
                <StatusPill value={item.status} />
              </button>

              {isSelected && (
                <ProductionEditor item={item} onProductionItemChange={onProductionItemChange} />
              )}
            </div>
          );
        })}
      </div>
    </CompactSection>
  );
}

function ProductionEditor({
  item,
  onProductionItemChange,
}: {
  item: ProductionItem;
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
    </div>
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
  const [selectedDate, setSelectedDate] = useState(anchorDate);
  const [visibleMonth, setVisibleMonth] = useState(firstDayOfMonth(anchorDate));
  const [dragTask, setDragTask] = useState<DragTask | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);
  const monthSwitchRef = useRef(0);
  useEffect(() => {
    setVisibleMonth(firstDayOfMonth(anchorDate));
    setSelectedDate(anchorDate);
  }, [anchorDate]);

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
        <div className="agendaList">
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
                if (!item.taskId) return;
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
      </div>
      <div className="calendarLegend">
        {[
          ["live", "ライブ"],
          ["ticket", "チケット"],
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
  return items.reduce<Array<{ kind: string; count: number }>>((groups, item) => {
    const found = groups.find((group) => group.kind === item.kind);
    if (found) {
      found.count += 1;
      return groups;
    }
    return [...groups, { kind: item.kind, count: 1 }];
  }, []);
}

function shortKind(kind: string) {
  if (kind === "チケット") return "券";
  if (kind === "ライブ") return "本";
  if (kind === "タスク") return "タ";
  if (kind === "ゲネ") return "ゲ";
  if (kind === "撮影") return "撮";
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
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="compactSection">
      <div className="compactTitle">
        {icon}
        <h3>{title}</h3>
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
    value === "遅延" || value === "未依頼" || value === "未作成"
      ? "danger"
      : value === "注意" || value === "制作中" || value === "確認待ち" || value === "作成中" || value === "確認中"
        ? "warn"
        : value === "完了" || value === "納品済" || value === "入稿済" || value === "公開済"
          ? "ok"
          : "blue";
  return <span className={`pill ${tone}`}>{value}</span>;
}

function ticketStatus(ticket: TicketPlan): TicketStatus {
  return ticket.status ?? (ticket.pageUrl ? "公開済" : "未作成");
}

function isProductionLate(item: ProductionItem) {
  return item.status !== "納品済" && daysUntil(item.dueDate) < 0;
}

function eventTone(kind: string) {
  if (kind === "ライブ") return "live";
  if (kind === "チケット") return "ticket";
  if (kind === "タスク") return "task";
  return "prep";
}

function generateTasks(projectId: string, eventDate: string): Task[] {
  const date = toDate(eventDate);
  return taskTemplates.map((template, index) => ({
    id: `${projectId}-task-${index}`,
    phase: template.phase,
    title: template.title,
    dueDate: addDays(date, template.offset),
    owner: template.owner,
    priority: template.priority,
    status: "未着手",
    memo: template.memo,
    subtasks: buildSubtasks(`${projectId}-task-${index}`, template.title),
  }));
}

function applyStatuses(tasks: Task[], statuses: Record<string, TaskStatus>) {
  return tasks.map((task) => updateTaskStatusValue(task, statuses[task.title] ?? task.status));
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
      owner: "佐藤",
      vendor: "未設定",
      dueDate: addDays(date, -45),
      status: "未依頼",
    },
    {
      id: `item-${crypto.randomUUID()}`,
      name: "ブロマイド",
      owner: "高橋",
      vendor: "未設定",
      dueDate: addDays(date, -20),
      status: "未依頼",
    },
    {
      id: `item-${crypto.randomUUID()}`,
      name: "VIP用ピクチャチケット",
      owner: "小林",
      vendor: "社内",
      dueDate: addDays(date, -7),
      status: "未依頼",
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
      owner: "田中",
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
  if (title.includes("セトリ") || title.includes("撮影")) return "高橋";
  if (title.includes("チケット")) return "小林";
  return "田中";
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

function formatDateTime(value: string) {
  const date = toDate(value);
  const time = value.includes("T") ? value.split("T")[1].slice(0, 5) : "";
  return `${date.getMonth() + 1}/${date.getDate()}${time ? ` ${time}` : ""}`;
}

function formatSchedule(value: string) {
  const date = extractDate(value);
  const time = extractTime(value);
  const place = value.includes("@") ? ` @${value.split("@")[1].trim()}` : "";
  return `${formatDate(date)}${time ? ` ${time}` : ""}${place}`;
}

function extractDate(value: string) {
  return value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? value.slice(0, 10);
}

function extractTime(value: string) {
  return value.includes("T") ? value.split("T")[1].slice(0, 5) : "";
}

export default App;
