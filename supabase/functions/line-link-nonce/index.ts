import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

type LinkNonceRequestBody = {
  linkToken?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabaseAuthKey = supabaseAnonKey || supabaseServiceRoleKey;

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
    : null;

const supabaseAuth =
  supabaseUrl && supabaseAuthKey
    ? createClient(supabaseUrl, supabaseAuthKey, { auth: { persistSession: false } })
    : null;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true }, 200);
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  if (!supabaseAdmin || !supabaseAuth) {
    return jsonResponse(
      {
        ok: false,
        error: "server_not_configured",
        detail: [
          supabaseUrl ? "" : "SUPABASE_URL missing",
          supabaseServiceRoleKey ? "" : "SUPABASE_SERVICE_ROLE_KEY missing",
          supabaseAuthKey ? "" : "SUPABASE_ANON_KEY or fallback auth key missing",
        ]
          .filter(Boolean)
          .join(", "),
      },
      500,
    );
  }

  const accessToken = getBearerToken(request.headers.get("authorization") ?? "");
  if (!accessToken) return jsonResponse({ ok: false, error: "missing_authorization" }, 401);

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse({ ok: false, error: "invalid_session", detail: userError?.message ?? "" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as LinkNonceRequestBody;
  const linkToken = body.linkToken?.trim() ?? "";
  if (!linkToken) return jsonResponse({ ok: false, error: "missing_link_token" }, 400);

  const nonce = createNonce();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabaseAdmin.from("line_link_nonces").delete().eq("user_id", userData.user.id);
  const { error: insertError } = await supabaseAdmin.from("line_link_nonces").insert({
    nonce,
    user_id: userData.user.id,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("Failed to create LINE link nonce", insertError);
    return jsonResponse({ ok: false, error: "nonce_create_failed", detail: insertError.message }, 500);
  }

  const accountLinkUrl = `https://access.line.me/dialog/bot/accountLink?linkToken=${encodeURIComponent(
    linkToken,
  )}&nonce=${encodeURIComponent(nonce)}`;

  return jsonResponse({ ok: true, accountLinkUrl, expiresAt }, 200);
});

function getBearerToken(authorization: string) {
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

function createNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
