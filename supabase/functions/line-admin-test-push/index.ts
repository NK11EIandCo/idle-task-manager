import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

type TestPushRequestBody = {
  appUserId?: string;
  text?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const lineChannelAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const authClient =
  supabaseUrl && (supabaseAnonKey || supabaseServiceRoleKey)
    ? createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

const adminClient =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true }, 200);
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  if (!lineChannelAccessToken || !authClient || !adminClient) {
    return jsonResponse({ ok: false, error: "server_not_configured" }, 500);
  }

  const accessToken = getBearerToken(request.headers.get("authorization") ?? "");
  if (!accessToken) return jsonResponse({ ok: false, error: "missing_access_token" }, 401);

  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return jsonResponse({ ok: false, error: "invalid_access_token", detail: authError?.message }, 401);
  }

  const callerProfileResult = await getCallerProfile(authData.user.id, authData.user.email ?? "");
  const callerProfile = callerProfileResult.profile;
  if (!callerProfile) {
    return jsonResponse(
      {
        ok: false,
        error: "caller_profile_not_found",
        detail:
          callerProfileResult.error ||
          `auth:${authData.user.id.slice(-8)} / email:${authData.user.email ?? "unknown"}`,
      },
      403,
    );
  }
  if (callerProfile.role !== "admin" || callerProfile.status !== "active") {
    return jsonResponse(
      {
        ok: false,
        error: "admin_required",
        detail: `role:${callerProfile.role ?? "unknown"} / status:${callerProfile.status ?? "unknown"}`,
      },
      403,
    );
  }

  const body = (await request.json().catch(() => ({}))) as TestPushRequestBody;
  const targetUserId = body.appUserId || authData.user.id;
  const targetProfileResult = await getProfile(targetUserId);
  const targetProfile = targetProfileResult.profile;
  if (!targetProfile) return jsonResponse({ ok: false, error: "target_profile_not_found" }, 404);

  const { data: lineAccount, error: lineAccountError } = await adminClient
    .from("user_line_accounts")
    .select("line_user_id")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (lineAccountError) {
    return jsonResponse({ ok: false, error: "line_account_lookup_failed", detail: lineAccountError.message }, 500);
  }
  if (!lineAccount?.line_user_id) {
    return jsonResponse({ ok: false, error: "line_account_not_linked" }, 404);
  }

  const sentAt = new Date();
  const message =
    body.text?.trim() ||
    `チェキ募集通知のテストです。\nアプリからLINEへ送信できています。\n送信時刻: ${formatJst(sentAt)}`;

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lineChannelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: lineAccount.line_user_id,
      messages: [{ type: "text", text: message }],
    }),
  });

  const errorText = response.ok ? null : await response.text();
  const { error: logError } = await adminClient.from("line_notification_logs").insert({
    line_user_id: lineAccount.line_user_id,
    event_type: "admin_test_push",
    message,
    status: response.ok ? "sent" : "failed",
    response_status: response.status,
    error_message: errorText,
  });

  if (!response.ok) {
    return jsonResponse({ ok: false, error: "line_push_failed", status: response.status, detail: errorText }, 502);
  }

  return jsonResponse(
    {
      ok: true,
      lineResponseStatus: response.status,
      lineUserSuffix: getLineUserSuffix(lineAccount.line_user_id),
      sentAt: sentAt.toISOString(),
      logStatus: logError ? "log_failed" : "logged",
      logError: logError?.message,
    },
    200,
  );
});

async function getProfile(userId: string) {
  if (!adminClient) return { profile: null, error: "admin_client_not_configured" };
  const { data, error } = await adminClient
    .from("app_user_profiles")
    .select("id, email, role, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to get app user profile", error);
    return { profile: null, error: error.message };
  }
  return { profile: data, error: null };
}

async function getCallerProfile(userId: string, email: string) {
  const profileResult = await getProfile(userId);
  if (profileResult.profile) return profileResult;
  if (!adminClient || !email.trim()) return profileResult;

  const { data, error } = await adminClient
    .from("app_user_profiles")
    .select("id, email, role, status")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("Failed to get app user profile by email", error);
    return { profile: null, error: error.message };
  }
  return { profile: data, error: profileResult.error };
}

function getBearerToken(value: string) {
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function getLineUserSuffix(lineUserId: string) {
  return lineUserId.slice(-6);
}

function formatJst(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
