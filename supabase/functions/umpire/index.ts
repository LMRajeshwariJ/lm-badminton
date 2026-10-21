declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
  env: { get(name: string): string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await request.json();
    const operation = String(body.operation ?? "");
    if (operation === "verify") return await verifyAccess(request, String(body.code ?? ""), body.access === "admin" ? "admin" : "umpire");

    const claims = await readSession(request);
    if (operation === "admin-write") {
      if (claims.role !== "admin") return json({ error: "An admin session is required." }, 403);
      const updates = Array.isArray(body.updates) ? body.updates : [];
      const deleteMatchIds = Array.isArray(body.deleteMatchIds) ? body.deleteMatchIds.slice(0, 30).map(String) : [];
      if (updates.length > 30 || !body.config) return json({ error: "Invalid admin update." }, 400);
      const result = await rpc<{ matches: unknown[]; configRevision: number }>("admin_write_tournament_state", {
        p_config: body.config,
        p_updates: updates,
        p_delete_match_ids: deleteMatchIds,
      });
      const releaseMatchIds = Array.isArray(body.releaseMatchIds) ? body.releaseMatchIds.slice(0, 30) : [];
      await Promise.all(releaseMatchIds.map((matchId: unknown) => rpc<boolean>("admin_release_match_lease", { p_match_id: String(matchId) })));
      return json(result);
    }
    if (body.umpireId && body.umpireId !== claims.sub) return json({ error: "Umpire session does not match." }, 401);
    const matchId = String(body.matchId ?? body.controllerMatchId ?? "");
    if (!matchId) return json({ error: "A match ID is required." }, 400);

    if (operation === "claim") {
      if (claims.role === "admin") return json({ ok: true, adminOverride: true });
      const ok = await rpc<boolean>("claim_match_lease", { p_match_id: matchId, p_umpire_id: claims.sub });
      return ok ? json({ ok, leaseExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() }) : json({ error: "Only the umpire who started this match can change it. An admin can override it." }, 409);
    }
    if (operation === "admin-release") {
      if (claims.role !== "admin") return json({ error: "An admin session is required." }, 403);
      const ok = await rpc<boolean>("admin_release_match_lease", { p_match_id: matchId });
      return json({ ok });
    }
    if (operation === "write") {
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (!updates.length || updates.length > 4) return json({ error: "Invalid match update batch." }, 400);
      const rows = claims.role === "admin"
        ? await rpc("admin_write_match_states", { p_updates: updates })
        : await rpc("write_match_states", {
            p_controller_match_id: matchId,
            p_umpire_id: claims.sub,
            p_updates: updates,
          });
      return json({ matches: rows });
    }
    return json({ error: "Unknown operation." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    if (message.includes("expired") || message.includes("Invalid umpire session")) return json({ error: message }, 401);
    if (message.includes("Stale match revision") || message.includes("lease expired") || message.includes("belongs to another umpire") || message.includes("umpire who started")) {
      return json({ error: message }, 409);
    }
    console.error("Umpire function error", message);
    return json({ error: "The scoring service could not complete that action." }, 500);
  }
});

async function verifyAccess(request: Request, code: string, access: "umpire" | "admin") {
  if (!code || code.length > 128) return json({ error: "Enter the umpire access code." }, 400);
  const env = requiredEnv();
  const requestIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = await hmacHex(env.sessionSecret, requestIp);
  const allowed = await rpc<boolean>("register_umpire_attempt", { p_ip_hash: ipHash });
  if (!allowed) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  const pepper = access === "admin" ? env.adminCodePepper : env.codePepper;
  const hash = access === "admin" ? env.adminCodeHash : env.codeHash;
  if (!pepper || !hash) return json({ error: "Admin access is not configured." }, 503);
  const suppliedHash = await hmacHex(pepper, code);
  if (!constantTimeEqual(suppliedHash, hash)) return json({ error: "That access code is not correct." }, 401);
  const umpireId = crypto.randomUUID();
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const token = await signSession({ sub: umpireId, role: access, iat: Math.floor(Date.now() / 1000), exp: Math.floor(expiresAt / 1000) }, env.sessionSecret);
  return json({ token, umpireId, expiresAt, role: access });
}

async function readSession(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Invalid umpire session.");
  const env = requiredEnv();
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid umpire session.");
  const expected = await hmacBase64Url(env.sessionSecret, `${parts[0]}.${parts[1]}`);
  if (!constantTimeEqual(expected, parts[2])) throw new Error("Invalid umpire session.");
  const claims = JSON.parse(decodeBase64Url(parts[1])) as { sub?: string; exp?: number; role?: string };
  if (!claims.sub || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error("Access session expired.");
  return claims as { sub: string; exp: number; role: "umpire" | "admin" };
}

async function signSession(claims: Record<string, unknown>, secret: string) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify(claims));
  return `${header}.${payload}.${await hmacBase64Url(secret, `${header}.${payload}`)}`;
}

async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const env = requiredEnv();
  const response = await fetch(`${env.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof result?.message === "string" ? result.message : `Database request failed (${response.status}).`);
  return result as T;
}

function requiredEnv() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const codePepper = Deno.env.get("UMPIRE_CODE_PEPPER");
  const codeHash = Deno.env.get("UMPIRE_ACCESS_CODE_HASH");
  const sessionSecret = Deno.env.get("UMPIRE_SESSION_SECRET");
  const adminCodePepper = Deno.env.get("ADMIN_CODE_PEPPER");
  const adminCodeHash = Deno.env.get("ADMIN_ACCESS_CODE_HASH");
  if (!url || !serviceKey || !codePepper || !codeHash || !sessionSecret) throw new Error("Umpire function secrets are not configured.");
  return { url, serviceKey, codePepper, codeHash, sessionSecret, adminCodePepper, adminCodeHash };
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacBase64Url(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlBytes(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function constantTimeEqual(left: string, right: string) {
  let mismatch = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index++) mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return mismatch === 0;
}

function base64Url(value: string) {
  return base64UrlBytes(encoder.encode(value));
}

function base64UrlBytes(value: Uint8Array) {
  let binary = "";
  value.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
