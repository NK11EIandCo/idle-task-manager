import { supabase, supabaseAnonKey, supabaseUrl } from "./supabaseClient";

type GroupRecord = {
  id?: string;
  name: string;
  manager: string;
  photo: string;
  calendarUrl?: string;
};

type SubTaskRecord = {
  id: string;
  title: string;
  done: boolean;
};

type TaskRecord = {
  id: string;
  phase: string;
  title: string;
  dueDate: string;
  owner: string;
  priority: string;
  status: string;
  memo?: string;
  subtasks?: SubTaskRecord[];
};

type TicketRecord = {
  id: string;
  name: string;
  price: number;
  saleStart: string;
  benefit: string;
  pageUrl?: string;
  status?: string;
};

type ProductionRecord = {
  id: string;
  name: string;
  owner: string;
  designer?: string;
  vendor: string;
  dueDate: string;
  status: string;
  fileUrl?: string;
  memo?: string;
};

type RunScheduleRecord = {
  id: string;
  day: string;
  time: string;
  title: string;
  ownerKind?: string;
  owner: string;
  place: string;
  note?: string;
};

type LiveRecord = {
  id: string;
  group: string;
  title: string;
  venue: string;
  eventDate: string;
  status: string;
  manager: string;
  liveType: string;
  ticketLaunch: string;
  rehearsal: string;
  photoShoot: string;
  productionCompany: string;
  driveFolderUrl?: string;
  sourceCalendarEventId?: string;
  tasks: TaskRecord[];
  tickets: TicketRecord[];
  productionItems: ProductionRecord[];
  scheduleItems?: RunScheduleRecord[];
};

type TaskTemplateItemRecord = {
  id: string;
  phase: string;
  title: string;
  offset: number;
  owner: string;
  priority: string;
  memo?: string;
  subtasks: string[];
};

type TaskTemplateRecord = {
  id: string;
  name: string;
  liveType: string;
  items: TaskTemplateItemRecord[];
};

type RunScheduleTemplateItemRecord = Omit<RunScheduleRecord, "id">;

type RunScheduleTemplateRecord = {
  id: string;
  name: string;
  liveType: string;
  items: RunScheduleTemplateItemRecord[];
};

export type ChekiRecruitmentRecord = {
  id: string;
  liveId?: string;
  group: string;
  liveTitle: string;
  venue: string;
  date: string;
  timeRange: string;
  liveType?: string;
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

export type WorkspaceData = {
  groups: GroupRecord[];
  projects: LiveRecord[];
  taskTemplateSets: TaskTemplateRecord[];
  runScheduleTemplateSets: RunScheduleTemplateRecord[];
  chekiRecruitments: ChekiRecruitmentRecord[];
  appliedChekiShiftIds: string[];
};

export type AppUserRole = "admin" | "employee" | "cheki";
export type AppUserStatus = "pending" | "active" | "suspended";

export type AppUserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: AppUserRole;
  status: AppUserStatus;
  lineUserId?: string;
  lineLinkedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type LineTestNotificationResult = {
  lineResponseStatus?: number;
  lineUserSuffix?: string;
  sentAt?: string;
  logStatus?: string;
};

type TableResult<T> = { data: T[] | null; error: { message: string } | null };

const orderedSelect = async <T>(table: string, order = "created_at") =>
  (await supabase!.from(table).select("*").order(order, { ascending: true })) as TableResult<T>;

const optionalOrderedSelect = async <T>(table: string, order = "created_at") => {
  const result = (await supabase!.from(table).select("*").order(order, { ascending: true })) as TableResult<T>;
  const message = result.error?.message ?? "";
  if (/does not exist|Could not find the table/i.test(message)) {
    return { data: [], error: null } as TableResult<T>;
  }
  return result;
};

function mapUserProfile(row: Record<string, unknown>): AppUserProfile {
  return {
    id: asString(row.id),
    email: asString(row.email),
    displayName: asString(row.display_name),
    role: asUserRole(row.role),
    status: asUserStatus(row.status),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export async function ensureCurrentUserProfile(userId: string, email: string): Promise<AppUserProfile> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const existing = (await supabase
    .from("app_user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()) as { data: Record<string, unknown> | null; error: { message: string } | null };

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return mapUserProfile(existing.data);

  const inserted = (await supabase
    .from("app_user_profiles")
    .insert({
      id: userId,
      email,
      role: "cheki",
      status: "pending",
    })
    .select()
    .single()) as { data: Record<string, unknown> | null; error: { message: string } | null };

  if (inserted.error) throw new Error(inserted.error.message);
  if (!inserted.data) throw new Error("ユーザープロファイルを作成できませんでした。");
  return mapUserProfile(inserted.data);
}

export async function loadUserProfiles(): Promise<AppUserProfile[]> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const [profileResult, lineAccountResult] = await Promise.all([
    (await supabase
      .from("app_user_profiles")
      .select("*")
      .order("created_at", { ascending: false })) as TableResult<Record<string, unknown>>,
    (await supabase.from("user_line_accounts").select("user_id, line_user_id, linked_at")) as TableResult<
      Record<string, unknown>
    >,
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (lineAccountResult.error) throw new Error(lineAccountResult.error.message);

  const lineAccountsByUserId = new Map(
    (lineAccountResult.data ?? []).map((row) => [
      asString(row.user_id),
      {
        lineUserId: optionalString(row.line_user_id),
        lineLinkedAt: optionalString(row.linked_at),
      },
    ]),
  );

  return (profileResult.data ?? []).map((row) => {
    const profile = mapUserProfile(row);
    return {
      ...profile,
      ...lineAccountsByUserId.get(profile.id),
    };
  });
}

export async function updateUserProfile(
  userId: string,
  updates: Pick<AppUserProfile, "role" | "status">,
): Promise<AppUserProfile> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const result = (await supabase
    .from("app_user_profiles")
    .update({
      role: updates.role,
      status: updates.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single()) as { data: Record<string, unknown> | null; error: { message: string } | null };

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("ユーザー情報を更新できませんでした。");
  return mapUserProfile(result.data);
}

export async function deleteUserProfile(userId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const rpcResult = await supabase.rpc("delete_app_user_profile", {
    target_user_id: userId,
  });
  if (!rpcResult.error) return;

  const fallbackResult = await supabase.from("app_user_profiles").delete().eq("id", userId);
  if (fallbackResult.error) throw new Error(fallbackResult.error.message || rpcResult.error.message);
}

export async function createLineAccountLink(linkToken: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`${supabaseUrl}/functions/v1/line-link-nonce`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session?.access_token ?? supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ linkToken }),
  });

  const data = (await response.json().catch(async () => ({
    error: await response.text().catch(() => ""),
  }))) as { accountLinkUrl?: string; error?: string; detail?: string };

  if (!response.ok || !data.accountLinkUrl) {
    const detail = [data.error, data.detail, `status:${response.status}`].filter(Boolean).join(" / ");
    throw new Error(detail || "LINE連携URLを作成できませんでした。");
  }

  return data.accountLinkUrl;
}

export async function sendLineTestNotification(appUserId: string): Promise<LineTestNotificationResult> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("ログイン情報を確認できませんでした。もう一度ログインしてください。");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/line-admin-test-push`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ appUserId }),
  });

  const data = (await response.json().catch(async () => ({
    error: await response.text().catch(() => ""),
  }))) as {
    ok?: boolean;
    error?: string;
    detail?: string;
    status?: number;
    lineResponseStatus?: number;
    lineUserSuffix?: string;
    sentAt?: string;
    logStatus?: string;
  };

  if (!response.ok || !data.ok) {
    const detail = [data.error, data.detail, data.status ? `LINE status:${data.status}` : "", `status:${response.status}`]
      .filter(Boolean)
      .join(" / ");
    throw new Error(detail || "LINEテスト通知を送信できませんでした。");
  }

  return {
    lineResponseStatus: data.lineResponseStatus,
    lineUserSuffix: data.lineUserSuffix,
    sentAt: data.sentAt,
    logStatus: data.logStatus,
  };
}

export async function loadWorkspaceData(userId: string, role: AppUserRole): Promise<WorkspaceData> {
  if (!supabase) throw new Error("Supabase is not configured.");

  if (role === "cheki") {
    const [groupResult, liveResult, chekiRecruitmentResult, chekiApplicationResult] = await Promise.all([
      orderedSelect<Record<string, unknown>>("idol_groups"),
      orderedSelect<Record<string, unknown>>("lives", "event_date"),
      optionalOrderedSelect<Record<string, unknown>>("cheki_recruitments", "event_date"),
      (await supabase
        .from("cheki_applications")
        .select("*")
        .eq("app_user_id", userId)) as TableResult<Record<string, unknown>>,
    ]);
    const error = [groupResult, liveResult, chekiRecruitmentResult, chekiApplicationResult].find((result) => result.error)?.error;
    if (error) throw new Error(error.message);

    const groups = (groupResult.data ?? []).map((row) => ({
      id: asString(row.id),
      name: asString(row.name),
      manager: asString(row.manager_name),
      photo: asString(row.photo_url),
      calendarUrl: optionalString(row.google_calendar_url),
    }));
    const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
    const projects = (liveResult.data ?? []).map((row) => {
      const groupId = asString(row.group_id);
      return {
        id: asString(row.id),
        group: groupNameById.get(groupId) ?? groupId,
        title: asString(row.title),
        venue: asString(row.venue),
        eventDate: asDateString(row.event_date),
        status: asString(row.status, "計画"),
        manager: asString(row.manager_name),
        liveType: asString(row.live_type, "ワンマン"),
        ticketLaunch: asString(row.ticket_launch_at),
        rehearsal: "",
        photoShoot: "",
        productionCompany: "",
        driveFolderUrl: undefined,
        tasks: [],
        tickets: [],
        productionItems: [],
        scheduleItems: [],
      };
    });

    return {
      groups,
      projects,
      taskTemplateSets: [],
      runScheduleTemplateSets: [],
      chekiRecruitments: mapChekiRecruitments(chekiRecruitmentResult.data ?? []),
      appliedChekiShiftIds: (chekiApplicationResult.data ?? [])
        .filter((row) => asString(row.status) === "応募済み")
        .map((row) => asString(row.shift_id)),
    };
  }

  const [
    groupResult,
    liveResult,
    taskResult,
    subtaskResult,
    ticketResult,
    productionResult,
    scheduleResult,
    taskTemplateResult,
    taskTemplateItemResult,
    taskTemplateSubtaskResult,
    runTemplateResult,
    runTemplateItemResult,
    chekiRecruitmentResult,
    chekiApplicationResult,
  ] = await Promise.all([
    orderedSelect<Record<string, unknown>>("idol_groups"),
    orderedSelect<Record<string, unknown>>("lives", "event_date"),
    orderedSelect<Record<string, unknown>>("tasks", "sort_order"),
    orderedSelect<Record<string, unknown>>("subtasks", "sort_order"),
    orderedSelect<Record<string, unknown>>("tickets", "sort_order"),
    orderedSelect<Record<string, unknown>>("production_items", "sort_order"),
    orderedSelect<Record<string, unknown>>("run_schedule_items", "sort_order"),
    orderedSelect<Record<string, unknown>>("task_templates"),
    orderedSelect<Record<string, unknown>>("task_template_items", "sort_order"),
    orderedSelect<Record<string, unknown>>("task_template_subtasks", "sort_order"),
    orderedSelect<Record<string, unknown>>("run_schedule_templates"),
    orderedSelect<Record<string, unknown>>("run_schedule_template_items", "sort_order"),
    optionalOrderedSelect<Record<string, unknown>>("cheki_recruitments", "event_date"),
    (await supabase
      .from("cheki_applications")
      .select("*")
      .eq("app_user_id", userId)) as TableResult<Record<string, unknown>>,
  ]);

  const results = [
    groupResult,
    liveResult,
    taskResult,
    subtaskResult,
    ticketResult,
    productionResult,
    scheduleResult,
    taskTemplateResult,
    taskTemplateItemResult,
    taskTemplateSubtaskResult,
    runTemplateResult,
    runTemplateItemResult,
    chekiRecruitmentResult,
    chekiApplicationResult,
  ];
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message);

  const groups = (groupResult.data ?? []).map((row) => ({
    id: asString(row.id),
    name: asString(row.name),
    manager: asString(row.manager_name),
    photo: asString(row.photo_url),
    calendarUrl: optionalString(row.google_calendar_url),
  }));
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  const subtasksByTask = groupBy(subtaskResult.data ?? [], "task_id");
  const tasksByLive = groupBy(taskResult.data ?? [], "live_id");
  const ticketsByLive = groupBy(ticketResult.data ?? [], "live_id");
  const productionByLive = groupBy(productionResult.data ?? [], "live_id");
  const scheduleByLive = groupBy(scheduleResult.data ?? [], "live_id");

  const projects = (liveResult.data ?? []).map((row) => {
    const id = asString(row.id);
    const groupId = asString(row.group_id);
    return {
      id,
      group: groupNameById.get(groupId) ?? groupId,
      title: asString(row.title),
      venue: asString(row.venue),
      eventDate: asDateString(row.event_date),
      status: asString(row.status, "計画"),
      manager: asString(row.manager_name),
      liveType: asString(row.live_type, "ワンマン"),
      ticketLaunch: asString(row.ticket_launch_at),
      rehearsal: asString(row.rehearsal_text),
      photoShoot: asString(row.photo_shoot_text),
      productionCompany: asString(row.production_company),
      driveFolderUrl: optionalString(row.drive_folder_url),
      sourceCalendarEventId: optionalString(row.source_calendar_event_id),
      tasks: (tasksByLive.get(id) ?? []).map((task) => {
        const taskId = asString(task.id);
        return {
          id: taskId,
          phase: asString(task.phase),
          title: asString(task.title),
          dueDate: asDateString(task.due_date),
          owner: asString(task.owner_name),
          priority: asString(task.priority, "通常"),
          status: asString(task.status, "未着手"),
          memo: optionalString(task.memo),
          subtasks: (subtasksByTask.get(taskId) ?? []).map((subtask) => ({
            id: asString(subtask.id),
            title: asString(subtask.title),
            done: Boolean(subtask.done),
          })),
        };
      }),
      tickets: (ticketsByLive.get(id) ?? []).map((ticket) => ({
        id: asString(ticket.id),
        name: asString(ticket.name),
        price: Number(ticket.price ?? 0),
        saleStart: asString(ticket.sale_start_at),
        benefit: asString(ticket.benefit),
        pageUrl: optionalString(ticket.page_url),
        status: optionalString(ticket.status),
      })),
      productionItems: (productionByLive.get(id) ?? []).map((item) => ({
        id: asString(item.id),
        name: asString(item.name),
        owner: asString(item.owner_name),
        designer: optionalString(item.designer_name),
        vendor: asString(item.vendor),
        dueDate: asDateString(item.due_date),
        status: asString(item.status, "未依頼"),
        fileUrl: optionalString(item.file_url),
        memo: optionalString(item.memo),
      })),
      scheduleItems: (scheduleByLive.get(id) ?? []).map((item) => ({
        id: asString(item.id),
        day: asString(item.day),
        time: asString(item.time),
        title: asString(item.title),
        ownerKind: optionalString(item.owner_kind),
        owner: asString(item.owner_name),
        place: asString(item.place),
        note: optionalString(item.note),
      })),
    };
  });

  const templateSubtasksByItem = groupBy(taskTemplateSubtaskResult.data ?? [], "template_item_id");
  const templateItemsByTemplate = groupBy(taskTemplateItemResult.data ?? [], "template_id");
  const taskTemplateSets = (taskTemplateResult.data ?? []).map((template) => {
    const id = asString(template.id);
    return {
      id,
      name: asString(template.name),
      liveType: asString(template.live_type, "共通"),
      items: (templateItemsByTemplate.get(id) ?? []).map((item) => {
        const itemId = asString(item.id);
        return {
          id: itemId,
          phase: asString(item.phase),
          title: asString(item.title),
          offset: Number(item.due_offset_days ?? -30),
          owner: asString(item.owner_name),
          priority: asString(item.priority, "通常"),
          memo: optionalString(item.memo),
          subtasks: (templateSubtasksByItem.get(itemId) ?? []).map((subtask) => asString(subtask.title)),
        };
      }),
    };
  });

  const runTemplateItemsByTemplate = groupBy(runTemplateItemResult.data ?? [], "template_id");
  const runScheduleTemplateSets = (runTemplateResult.data ?? []).map((template) => {
    const id = asString(template.id);
    return {
      id,
      name: asString(template.name),
      liveType: asString(template.live_type, "共通"),
      items: (runTemplateItemsByTemplate.get(id) ?? []).map((item) => ({
        day: asString(item.day),
        time: asString(item.time),
        title: asString(item.title),
        ownerKind: optionalString(item.owner_kind),
        owner: asString(item.owner_name),
        place: asString(item.place),
        note: optionalString(item.note),
      })),
    };
  });

  return {
    groups,
    projects,
    taskTemplateSets,
    runScheduleTemplateSets,
    chekiRecruitments: mapChekiRecruitments(chekiRecruitmentResult.data ?? []),
    appliedChekiShiftIds: (chekiApplicationResult.data ?? [])
      .filter((row) => asString(row.status) === "応募済み")
      .map((row) => asString(row.shift_id)),
  };
}

export async function saveWorkspaceData(data: WorkspaceData, userId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const groups = data.groups.map((group, index) => ({
    id: group.id || stableId("group", group.name),
    name: group.name,
    manager_name: group.manager,
    photo_url: group.photo || null,
    google_calendar_url: group.calendarUrl || null,
    sort_order: index,
  }));
  const groupIdByName = new Map(groups.map((group) => [group.name, group.id]));

  const lives = data.projects.map((project, index) => ({
    id: project.id,
    group_id: groupIdByName.get(project.group) ?? stableId("group", project.group),
    title: project.title,
    venue: project.venue,
    event_date: project.eventDate || null,
    status: project.status,
    live_type: project.liveType,
    manager_name: project.manager,
    ticket_launch_at: emptyToNull(project.ticketLaunch),
    rehearsal_text: project.rehearsal || null,
    photo_shoot_text: project.photoShoot || null,
    production_company: project.productionCompany || null,
    drive_folder_url: project.driveFolderUrl || null,
    source_calendar_event_id: project.sourceCalendarEventId || null,
    sort_order: index,
  }));

  const tasks = data.projects.flatMap((project) =>
    project.tasks.map((task, index) => ({
      id: task.id,
      live_id: project.id,
      phase: task.phase,
      title: task.title,
      due_date: task.dueDate || null,
      owner_name: task.owner,
      priority: task.priority,
      status: task.status,
      memo: task.memo || null,
      sort_order: index,
    })),
  );
  const subtasks = data.projects.flatMap((project) =>
    project.tasks.flatMap((task) =>
      (task.subtasks ?? []).map((subtask, index) => ({
        id: subtask.id,
        task_id: task.id,
        title: subtask.title,
        done: subtask.done,
        sort_order: index,
      })),
    ),
  );
  const tickets = data.projects.flatMap((project) =>
    project.tickets.map((ticket, index) => ({
      id: ticket.id,
      live_id: project.id,
      name: ticket.name,
      price: ticket.price,
      sale_start_at: emptyToNull(ticket.saleStart),
      benefit: ticket.benefit || null,
      page_url: ticket.pageUrl || null,
      status: ticket.status || null,
      sort_order: index,
    })),
  );
  const productionItems = data.projects.flatMap((project) =>
    project.productionItems.map((item, index) => ({
      id: item.id,
      live_id: project.id,
      name: item.name,
      owner_name: item.owner,
      designer_name: item.designer || null,
      vendor: item.vendor,
      due_date: item.dueDate || null,
      status: item.status,
      file_url: item.fileUrl || null,
      memo: item.memo || null,
      sort_order: index,
    })),
  );
  const scheduleItems = data.projects.flatMap((project) =>
    (project.scheduleItems ?? []).map((item, index) => ({
      id: item.id,
      live_id: project.id,
      day: item.day,
      time: item.time,
      title: item.title,
      owner_kind: item.ownerKind || null,
      owner_name: item.owner,
      place: item.place,
      note: item.note || null,
      sort_order: index,
    })),
  );
  const taskTemplates = data.taskTemplateSets.map((template, index) => ({
    id: template.id,
    name: template.name,
    live_type: template.liveType,
    sort_order: index,
  }));
  const taskTemplateItems = data.taskTemplateSets.flatMap((template) =>
    template.items.map((item, index) => ({
      id: item.id,
      template_id: template.id,
      phase: item.phase,
      title: item.title,
      due_offset_days: item.offset,
      owner_name: item.owner,
      priority: item.priority,
      memo: item.memo || null,
      sort_order: index,
    })),
  );
  const taskTemplateSubtasks = data.taskTemplateSets.flatMap((template) =>
    template.items.flatMap((item) =>
      item.subtasks.map((title, index) => ({
        id: `${item.id}-subtask-${index}`,
        template_item_id: item.id,
        title,
        sort_order: index,
      })),
    ),
  );
  const runScheduleTemplates = data.runScheduleTemplateSets.map((template, index) => ({
    id: template.id,
    name: template.name,
    live_type: template.liveType,
    sort_order: index,
  }));
  const runScheduleTemplateItems = data.runScheduleTemplateSets.flatMap((template) =>
    template.items.map((item, index) => ({
      id: `${template.id}-item-${index}`,
      template_id: template.id,
      day: item.day,
      time: item.time,
      title: item.title,
      owner_kind: item.ownerKind || null,
      owner_name: item.owner,
      place: item.place,
      note: item.note || null,
      sort_order: index,
    })),
  );
  const chekiApplications = data.appliedChekiShiftIds.map((shiftId) => ({
    id: `cheki-${userId}-${shiftId}`,
    shift_id: shiftId,
    recruitment_id: shiftId.startsWith("cheki-rec-") ? shiftId : null,
    app_user_id: userId,
    status: "応募済み",
  }));

  await upsertRows("idol_groups", groups);
  await upsertRows("task_templates", taskTemplates);
  await upsertRows("run_schedule_templates", runScheduleTemplates);
  await upsertRows("lives", lives);
  await upsertRows("tasks", tasks);
  await upsertRows("tickets", tickets);
  await upsertRows("production_items", productionItems);
  await upsertRows("run_schedule_items", scheduleItems);
  await upsertRows("task_template_items", taskTemplateItems);
  await upsertRows("run_schedule_template_items", runScheduleTemplateItems);
  await upsertRows("subtasks", subtasks);
  await upsertRows("task_template_subtasks", taskTemplateSubtasks);
  await upsertRows("cheki_applications", chekiApplications);

  await deleteMissingRows("subtasks", subtasks.map((row) => row.id));
  await deleteMissingRows("task_template_subtasks", taskTemplateSubtasks.map((row) => row.id));
  await deleteMissingRows("tasks", tasks.map((row) => row.id));
  await deleteMissingRows("tickets", tickets.map((row) => row.id));
  await deleteMissingRows("production_items", productionItems.map((row) => row.id));
  await deleteMissingRows("run_schedule_items", scheduleItems.map((row) => row.id));
  await deleteMissingRows("task_template_items", taskTemplateItems.map((row) => row.id));
  await deleteMissingRows("run_schedule_template_items", runScheduleTemplateItems.map((row) => row.id));
  await deleteMissingRows("lives", lives.map((row) => row.id));
  await deleteMissingRows("task_templates", taskTemplates.map((row) => row.id));
  await deleteMissingRows("run_schedule_templates", runScheduleTemplates.map((row) => row.id));
  await deleteMissingRows("idol_groups", groups.map((row) => row.id));
  await deleteMissingRows(
    "cheki_applications",
    chekiApplications.map((row) => row.id),
    { column: "app_user_id", value: userId },
  );
}

export async function saveChekiApplications(userId: string, appliedChekiShiftIds: string[]): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const chekiApplications = appliedChekiShiftIds.map((shiftId) => ({
    id: `cheki-${userId}-${shiftId}`,
    shift_id: shiftId,
    recruitment_id: shiftId.startsWith("cheki-rec-") ? shiftId : null,
    app_user_id: userId,
    status: "応募済み",
  }));

  await upsertRows("cheki_applications", chekiApplications);
  await deleteMissingRows(
    "cheki_applications",
    chekiApplications.map((row) => row.id),
    { column: "app_user_id", value: userId },
  );
}

async function upsertRows(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const { error } = await supabase!.from(table).upsert(rows);
  if (error) throw new Error(error.message);
}

async function deleteMissingRows(
  table: string,
  ids: string[],
  scope?: { column: string; value: string },
) {
  let query = supabase!.from(table).delete();
  if (scope) query = query.eq(scope.column, scope.value);

  const result =
    ids.length === 0
      ? await query.neq("id", "__keep__")
      : await query.not("id", "in", `(${ids.map(escapePostgrestValue).join(",")})`);
  if (result.error) throw new Error(result.error.message);
}

function groupBy(rows: Record<string, unknown>[], key: string) {
  const map = new Map<string, Record<string, unknown>[]>();
  rows.forEach((row) => {
    const value = asString(row[key]);
    const current = map.get(value) ?? [];
    current.push(row);
    map.set(value, current);
  });
  return map;
}

function mapChekiRecruitments(rows: Record<string, unknown>[]): ChekiRecruitmentRecord[] {
  return rows
    .filter((row) => !row.archived_at)
    .map((row) => ({
      id: asString(row.id),
      liveId: optionalString(row.live_id),
      group: asString(row.group_name),
      liveTitle: asString(row.live_title),
      venue: asString(row.venue, "未設定"),
      date: asDateString(row.event_date),
      timeRange: asString(row.time_range, "18:00-21:30"),
      liveType: optionalString(row.live_type),
      role: asString(row.role_description, "チェキ列整理、撮影補助、販売導線の案内、終演後の物販撤収補助"),
      requiredCount: Number(row.required_count ?? 0),
      assignedCount: Number(row.assigned_count ?? 0),
      status: asChekiRecruitmentStatus(row.status),
      cancelUntil: asDateString(row.cancel_until),
      meetingTime: asString(row.meeting_time, "確定後に共有"),
      meetingPlace: asString(row.meeting_place, "確定後に共有"),
      belongings: asString(row.belongings, "黒系の服装、身分証、筆記用具、飲み物"),
      memo: asString(row.memo, "服装は黒系推奨。集合場所は確定後に共有します。"),
    }))
    .filter((row) => row.id && row.liveTitle && row.date);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asUserRole(value: unknown): AppUserRole {
  return value === "admin" || value === "employee" || value === "cheki" ? value : "cheki";
}

function asUserStatus(value: unknown): AppUserStatus {
  return value === "active" || value === "suspended" || value === "pending" ? value : "pending";
}

function asChekiRecruitmentStatus(value: unknown): ChekiRecruitmentRecord["status"] {
  return value === "確定" || value === "応募済み" || value === "募集中" ? value : "募集中";
}

function optionalString(value: unknown) {
  const text = asString(value);
  return text || undefined;
}

function asDateString(value: unknown) {
  return asString(value).slice(0, 10);
}

function emptyToNull(value: string | undefined) {
  return value && value.trim() ? value : null;
}

function stableId(prefix: string, value: string) {
  const encoded = Array.from(value)
    .map((char) => char.codePointAt(0)?.toString(36) ?? "")
    .join("-");
  return `${prefix}-${encoded || "item"}`;
}

function escapePostgrestValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}
