import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

type SheetImportRequest = {
  spreadsheetId?: string;
  sheetId?: string;
  sheetName?: string;
  testOnly?: boolean;
  rows?: SheetImportRow[];
};

type SheetImportRow = {
  rowNumber?: number;
  rowUid?: string;
  eventName?: string;
  eventDate?: string;
  groupName?: string;
  staffName?: string;
  status?: string;
  employeeName?: string;
  liveType?: string;
  venue?: string;
};

type NormalizedRow = {
  rowNumber: number;
  rowUid: string;
  eventName: string;
  eventDate: string;
  groupName: string;
  staffName: string;
  status: string;
  employeeName: string;
  liveType: string;
  venue: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sheet-sync-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sheetSyncToken = Deno.env.get("CHEKI_SHEET_SYNC_TOKEN") ?? "";

const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
    : null;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true }, 200);
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  if (!supabase || !sheetSyncToken) {
    return jsonResponse({ ok: false, error: "server_not_configured" }, 500);
  }

  if (request.headers.get("x-sheet-sync-token") !== sheetSyncToken) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as SheetImportRequest;
  const spreadsheetId = cleanText(body.spreadsheetId);
  const sheetId = cleanText(body.sheetId);
  const rawRows = Array.isArray(body.rows) ? body.rows : [];

  if (!spreadsheetId || !sheetId) {
    return jsonResponse({ ok: false, error: "missing_sheet_identity" }, 400);
  }
  if (body.testOnly) {
    return jsonResponse({ ok: true, message: "cheki_sheet_import_ready" }, 200);
  }

  const normalizedRows = rawRows
    .map((row, index) => normalizeRow(row, index))
    .filter((row): row is NormalizedRow => Boolean(row));

  if (normalizedRows.length === 0) {
    return jsonResponse({ ok: false, error: "no_valid_rows" }, 400);
  }

  const rowsByRecruitment = groupBy(normalizedRows, (row) =>
    [row.groupName, row.eventDate, row.eventName, row.venue, row.liveType].join("|"),
  );
  const processedRows: Array<{
    rowNumber: number;
    rowUid: string;
    recruitmentId: string;
    slotId: string;
    status: string;
  }> = [];

  try {
    for (const rows of rowsByRecruitment.values()) {
      const first = rows[0];
      const group = await findOrCreateGroup(first.groupName);
      const liveId = await findOrCreateLive(group.id, first);
      const sourceKey = await stableHash([first.groupName, first.eventDate, first.eventName, first.venue, first.liveType].join("|"));
      const recruitmentId = `cheki-rec-${sourceKey.slice(0, 26)}`;
      const assignedCount = rows.filter((row) => isAssignedSlot(row)).length;
      const requiredCount = rows.length;
      const recruitmentStatus = requiredCount > 0 && assignedCount >= requiredCount ? "確定" : "募集中";

      const recruitment = {
        id: recruitmentId,
        live_id: liveId,
        group_id: group.id,
        group_name: first.groupName,
        live_title: first.eventName,
        venue: first.venue,
        event_date: first.eventDate,
        time_range: inferTimeRange(first.eventName),
        live_type: first.liveType,
        role_description: "チェキ列整理、撮影補助、販売導線の案内、終演後の物販撤収補助",
        required_count: requiredCount,
        assigned_count: assignedCount,
        status: recruitmentStatus,
        cancel_until: addDays(first.eventDate, -3),
        meeting_time: inferMeetingTime(first.eventName),
        meeting_place: first.venue ? `${first.venue} 入口付近` : "確定後に共有",
        belongings: "黒系の服装、身分証、筆記用具、飲み物",
        memo: "服装は黒系推奨。集合場所は確定後に共有します。",
        source_spreadsheet_id: spreadsheetId,
        source_sheet_id: sheetId,
        source_key: sourceKey,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
      };

      const { error: recruitmentError } = await supabase
        .from("cheki_recruitments")
        .upsert(recruitment, { onConflict: "id" });
      if (recruitmentError) {
        return jsonResponse(
          { ok: false, error: "recruitment_upsert_failed", detail: recruitmentError.message },
          500,
        );
      }

      const slots = await Promise.all(rows.map(async (row, index) => {
        const slotHash = await stableHash([spreadsheetId, sheetId, row.rowUid].join("|"));
        return {
          id: `cheki-slot-${slotHash.slice(0, 26)}`,
          recruitment_id: recruitmentId,
          source_spreadsheet_id: spreadsheetId,
          source_sheet_id: sheetId,
          source_row_uid: row.rowUid,
          source_row_number: row.rowNumber,
          event_name: row.eventName,
          event_date: row.eventDate,
          group_name: row.groupName,
          staff_name: row.staffName || null,
          sheet_status: row.status || null,
          employee_name: row.employeeName || null,
          live_type: row.liveType || null,
          venue: row.venue || null,
          sort_order: index,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }));

      const { error: slotError } = await supabase
        .from("cheki_recruitment_slots")
        .upsert(slots, { onConflict: "source_spreadsheet_id,source_sheet_id,source_row_uid" });
      if (slotError) {
        return jsonResponse({ ok: false, error: "slot_upsert_failed", detail: slotError.message }, 500);
      }

      for (const slot of slots) {
        processedRows.push({
          rowNumber: slot.source_row_number ?? 0,
          rowUid: slot.source_row_uid,
          recruitmentId,
          slotId: slot.id,
          status: "反映済み",
        });
      }
    }
  } catch (error) {
    return jsonResponse(
      { ok: false, error: "sheet_import_failed", detail: error instanceof Error ? error.message : String(error) },
      500,
    );
  }

  return jsonResponse(
    {
      ok: true,
      importedRows: processedRows.length,
      importedRecruitments: rowsByRecruitment.size,
      rows: processedRows,
    },
    200,
  );
});

async function findOrCreateGroup(groupName: string): Promise<{ id: string; name: string }> {
  const { data: existing, error: selectError } = await supabase!
    .from("idol_groups")
    .select("id, name")
    .eq("name", groupName)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing?.id) return { id: existing.id, name: existing.name };

  const groupHash = await stableHash(groupName);
  const group = {
    id: `sheet-group-${groupHash.slice(0, 18)}`,
    name: groupName,
    manager_name: "",
    photo_url: null,
    google_calendar_url: null,
    sort_order: 999,
    updated_at: new Date().toISOString(),
  };
  const { error: insertError } = await supabase!.from("idol_groups").upsert(group, { onConflict: "id" });
  if (insertError) throw insertError;
  return { id: group.id, name: group.name };
}

async function findOrCreateLive(groupId: string, row: NormalizedRow): Promise<string> {
  const { data: existing, error: selectError } = await supabase!
    .from("lives")
    .select("id")
    .eq("group_id", groupId)
    .eq("event_date", row.eventDate)
    .eq("title", row.eventName)
    .limit(1)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing?.id) return existing.id;

  const liveHash = await stableHash([groupId, row.eventDate, row.eventName, row.venue].join("|"));
  const liveId = `sheet-live-${liveHash.slice(0, 26)}`;
  const { error: upsertError } = await supabase!.from("lives").upsert(
    {
      id: liveId,
      group_id: groupId,
      title: row.eventName,
      venue: row.venue,
      event_date: row.eventDate,
      status: "進行中",
      live_type: mapLiveTypeForWorkPage(row.liveType),
      manager_name: "",
      ticket_launch_at: null,
      rehearsal_text: null,
      photo_shoot_text: null,
      production_company: null,
      drive_folder_url: null,
      source_calendar_event_id: `sheet:${row.rowUid}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (upsertError) throw upsertError;
  return liveId;
}

function normalizeRow(row: SheetImportRow, index: number): NormalizedRow | null {
  const eventName = cleanText(row.eventName);
  const eventDate = normalizeDate(row.eventDate);
  const groupName = normalizeGroupName(row.groupName);
  if (!eventName || !eventDate || !groupName) return null;
  if (eventName === "イベント名" || row.eventDate === "yyyy/mm/dd") return null;

  const venue = cleanVenue(row.venue);
  return {
    rowNumber: Number(row.rowNumber || index + 2),
    rowUid: cleanText(row.rowUid) || `row-${index + 2}`,
    eventName,
    eventDate,
    groupName,
    staffName: cleanText(row.staffName),
    status: cleanText(row.status),
    employeeName: cleanText(row.employeeName),
    liveType: normalizeLiveType(row.liveType, eventName),
    venue,
  };
}

function normalizeDate(value?: string) {
  const text = cleanText(value);
  if (!text) return "";
  const isoDateMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDateMatch) return `${isoDateMatch[1]}-${isoDateMatch[2].padStart(2, "0")}-${isoDateMatch[3].padStart(2, "0")}`;
  const slashMatch = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[3].padStart(2, "0")}`;
  const shortMatch = text.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (shortMatch) {
    const now = new Date();
    return `${now.getFullYear()}-${shortMatch[1].padStart(2, "0")}-${shortMatch[2].padStart(2, "0")}`;
  }
  return "";
}

function normalizeGroupName(value?: string) {
  const text = cleanText(value);
  if (!text) return "";
  if (/scramble/i.test(text) || text.includes("スクランブル")) return "SCRAMBLE SMILE";
  if (/hey!?mommy/i.test(text) || text.includes("ヘイマミー")) return "Hey!Mommy!";
  return text;
}

function normalizeLiveType(value: string | undefined, eventName: string) {
  const text = cleanText(value);
  if (text) return text;
  return eventName.includes("対バン") ? "対バン" : "主催";
}

function mapLiveTypeForWorkPage(liveType: string) {
  if (liveType.includes("生誕")) return "生誕祭";
  if (liveType.includes("定期")) return "定期公演";
  if (liveType.includes("主催")) return "ワンマン";
  return "定期公演";
}

function cleanVenue(value?: string) {
  return cleanText(value).replace(/^@+/, "");
}

function cleanText(value?: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isAssignedSlot(row: NormalizedRow) {
  const status = row.status;
  return Boolean(row.staffName) || /確定|決定|稼働|完了|済|アサイン|埋/.test(status);
}

function inferTimeRange(eventName: string) {
  return eventName.includes("主催") || eventName.includes("ワンマン") ? "16:30-21:30" : "18:00-21:30";
}

function inferMeetingTime(eventName: string) {
  return eventName.includes("主催") || eventName.includes("ワンマン") ? "16:00" : "17:30";
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function groupBy<T>(values: T[], getKey: (value: T) => string) {
  const map = new Map<string, T[]>();
  for (const value of values) {
    const key = getKey(value);
    const current = map.get(key) ?? [];
    current.push(value);
    map.set(key, current);
  }
  return map;
}

async function stableHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
