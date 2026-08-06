import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

type PushRequestBody = {
  to?: string;
  text?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-test-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const lineChannelAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const testAdminKey = Deno.env.get("LINE_TEST_ADMIN_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true }, 200);
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  if (!lineChannelAccessToken || !testAdminKey || !supabase) {
    return jsonResponse({ ok: false, error: "server_not_configured" }, 500);
  }

  if (request.headers.get("x-test-key") !== testAdminKey) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as PushRequestBody;
  const to = body.to || (await getLatestLineUserId());
  const text = body.text || "LINE通知テストです。アプリから通知を送信できています。";

  if (!to) return jsonResponse({ ok: false, error: "line_user_not_found" }, 404);

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lineChannelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });

  const errorText = response.ok ? null : await response.text();
  await supabase.from("line_notification_logs").insert({
    line_user_id: to,
    event_type: "push_test",
    message: text,
    status: response.ok ? "sent" : "failed",
    response_status: response.status,
    error_message: errorText,
  });

  if (!response.ok) return jsonResponse({ ok: false, status: response.status, error: errorText }, 502);
  return jsonResponse({ ok: true, to }, 200);
});

async function getLatestLineUserId() {
  if (!supabase) return "";
  const { data, error } = await supabase
    .from("line_contacts")
    .select("line_user_id")
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to get latest LINE user", error);
    return "";
  }
  return data?.line_user_id ?? "";
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
