import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

type LineWebhookBody = {
  destination?: string;
  events?: LineWebhookEvent[];
};

type LineWebhookEvent = {
  type?: string;
  replyToken?: string;
  source?: {
    type?: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type?: string;
    id?: string;
    text?: string;
  };
  postback?: {
    data?: string;
  };
  link?: {
    result?: string;
    nonce?: string;
  };
};

type ProfileResponse = {
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-line-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LINK_POSTBACK_DATA = "action=link";
const LINK_KEYWORDS = ["連携", "れんけい", "link"];

const lineChannelSecret = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
const lineChannelAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200);
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!lineChannelSecret || !lineChannelAccessToken || !appBaseUrl || !supabase) {
    return jsonResponse({ ok: false, error: "server_not_configured" }, 500);
  }

  const signature = request.headers.get("x-line-signature") ?? "";
  const rawBytes = new Uint8Array(await request.arrayBuffer());
  const verified = await verifyLineSignature(rawBytes, signature, lineChannelSecret);

  if (!verified) {
    return jsonResponse({ ok: false, error: "invalid_signature" }, 401);
  }

  const rawBody = new TextDecoder().decode(rawBytes);
  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const events = body.events ?? [];
  for (const event of events) {
    try {
      await handleLineEvent(event);
    } catch (error) {
      console.error("Failed to handle LINE event", event.type, error);
    }
  }

  return jsonResponse({ ok: true, received: events.length }, 200);
});

async function handleLineEvent(event: LineWebhookEvent) {
  const lineUserId = event.source?.userId;
  if (lineUserId) await upsertLineContact(event);

  switch (event.type) {
    case "follow":
      await startLineLinking(event);
      break;
    case "postback":
      if (event.postback?.data === LINK_POSTBACK_DATA) await startLineLinking(event);
      break;
    case "message": {
      const text = event.message?.type === "text" ? event.message.text?.trim() ?? "" : "";
      if (text && LINK_KEYWORDS.some((keyword) => text === keyword || text.includes(keyword))) {
        await startLineLinking(event);
      } else if (event.replyToken && lineUserId) {
        await replyMessage(
          event.replyToken,
          "通知連携を行う場合は「連携」と送信してください。",
          lineUserId,
          "reply:help",
        );
      }
      break;
    }
    case "accountLink":
      await finalizeLineLinking(event);
      break;
    default:
      if (lineUserId && supabase) {
        await supabase.from("line_notification_logs").insert({
          line_user_id: lineUserId,
          event_type: `webhook:${event.type ?? "unknown"}`,
          status: "received",
        });
      }
      break;
  }
}

async function upsertLineContact(event: LineWebhookEvent) {
  const lineUserId = event.source?.userId;
  if (!lineUserId || !supabase) return;
  const profile = await fetchLineProfile(lineUserId);
  const lastMessageText = event.message?.type === "text" ? event.message.text ?? "" : "";

  const { error } = await supabase.from("line_contacts").upsert({
    line_user_id: lineUserId,
    display_name: profile?.displayName ?? null,
    picture_url: profile?.pictureUrl ?? null,
    status_message: profile?.statusMessage ?? null,
    last_event_type: event.type ?? "unknown",
    last_message_text: lastMessageText,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to upsert LINE contact", error);
    return;
  }

  await supabase.from("line_notification_logs").insert({
    line_user_id: lineUserId,
    event_type: `webhook:${event.type ?? "unknown"}`,
    message: lastMessageText,
    status: "received",
  });
}

async function startLineLinking(event: LineWebhookEvent) {
  const lineUserId = event.source?.userId;
  const replyToken = event.replyToken;
  if (!lineUserId || !replyToken) return;

  const linkToken = await issueLinkToken(lineUserId);
  if (!linkToken) {
    await replyMessage(
      replyToken,
      "連携用リンクの発行に失敗しました。時間をおいて再度お試しください。",
      lineUserId,
      "reply:link_token_failed",
    );
    return;
  }

  const loginUrl = `${appBaseUrl.replace(/\/$/, "")}/line-link?linkToken=${encodeURIComponent(linkToken)}`;
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lineChannelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "template",
          altText: "アカウント連携のご案内",
          template: {
            type: "buttons",
            text: "アプリとLINEを連携します。下のボタンからアプリにログインしてください。",
            actions: [{ type: "uri", label: "連携をはじめる", uri: loginUrl }],
          },
        },
      ],
    }),
  });

  await supabase?.from("line_notification_logs").insert({
    line_user_id: lineUserId,
    event_type: "reply:link_start",
    message: "アカウント連携URLを送信しました。",
    status: response.ok ? "sent" : "failed",
    response_status: response.status,
    error_message: response.ok ? null : await response.text(),
  });
}

async function finalizeLineLinking(event: LineWebhookEvent) {
  const lineUserId = event.source?.userId;
  const replyToken = event.replyToken;
  const result = event.link?.result;
  const nonce = event.link?.nonce;

  if (result !== "ok") {
    if (replyToken && lineUserId) {
      await replyMessage(
        replyToken,
        "連携に失敗しました。お手数ですが最初からやり直してください。",
        lineUserId,
        "reply:link_failed",
      );
    }
    return;
  }
  if (!lineUserId || !nonce || !supabase) return;

  const nowIso = new Date().toISOString();
  const { data: nonceRow, error: nonceError } = await supabase
    .from("line_link_nonces")
    .select("user_id, expires_at")
    .eq("nonce", nonce)
    .maybeSingle();

  if (nonceError) {
    console.error("Failed to read line_link_nonces", nonceError);
    return;
  }

  const nonceData = nonceRow as { user_id: string; expires_at: string } | null;
  if (!nonceData || nonceData.expires_at < nowIso) {
    if (nonceData) await supabase.from("line_link_nonces").delete().eq("nonce", nonce);
    if (replyToken) {
      await replyMessage(
        replyToken,
        "連携の有効期限が切れました。お手数ですが最初からやり直してください。",
        lineUserId,
        "reply:link_expired",
      );
    }
    return;
  }

  const { error: upsertError } = await supabase.from("user_line_accounts").upsert(
    {
      user_id: nonceData.user_id,
      line_user_id: lineUserId,
      linked_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );

  await supabase.from("line_link_nonces").delete().eq("nonce", nonce);

  if (upsertError) {
    console.error("Failed to upsert user_line_accounts", upsertError);
    if (replyToken) {
      await replyMessage(
        replyToken,
        "連携の保存中にエラーが発生しました。別のアカウントに連携済みの可能性があります。",
        lineUserId,
        "reply:link_save_failed",
      );
    }
    return;
  }

  if (replyToken) {
    await replyMessage(replyToken, "アプリとLINEの連携が完了しました。", lineUserId, "reply:link_done");
  }
}

async function issueLinkToken(lineUserId: string): Promise<string | null> {
  const response = await fetch(`https://api.line.me/v2/bot/user/${lineUserId}/linkToken`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lineChannelAccessToken}` },
  });

  if (!response.ok) {
    console.error("Failed to issue LINE link token", response.status, await response.text());
    return null;
  }
  const data = (await response.json().catch(() => null)) as { linkToken?: string } | null;
  return data?.linkToken ?? null;
}

async function fetchLineProfile(lineUserId: string): Promise<ProfileResponse | null> {
  if (!lineChannelAccessToken) return null;

  const response = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
    headers: {
      Authorization: `Bearer ${lineChannelAccessToken}`,
    },
  });

  if (!response.ok) return null;
  return (await response.json()) as ProfileResponse;
}

async function replyMessage(replyToken: string, text: string, lineUserId: string, eventType = "reply") {
  if (!lineChannelAccessToken || !supabase) return;

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lineChannelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  await supabase.from("line_notification_logs").insert({
    line_user_id: lineUserId,
    event_type: eventType,
    message: text,
    status: response.ok ? "sent" : "failed",
    response_status: response.status,
    error_message: response.ok ? null : await response.text(),
  });
}

async function verifyLineSignature(rawBytes: Uint8Array, signature: string, channelSecret: string) {
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, rawBytes);
  const expected = base64Encode(new Uint8Array(digest));

  return timingSafeEqual(expected, signature);
}

function base64Encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
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
