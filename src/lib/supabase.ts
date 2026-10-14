import type { AppState, Match, TournamentConfigState } from "@/types";

const SESSION_KEY = "lm-badminton-umpire-session";
const REVISION_KEY = "lm-badminton-match-revisions";
const ADMIN_SESSION_KEY = "lm-badminton-admin-session";
const CONFIG_REVISION_KEY = "lm-badminton-config-revision";

export interface UmpireSession {
  token: string;
  umpireId: string;
  expiresAt: number;
  role?: "umpire" | "admin";
}

export interface AdminSession extends UmpireSession {
  role: "admin";
}

export interface RemoteMatch {
  match_id: string;
  state: Match;
  revision: number;
}

export interface RemoteTournamentConfig {
  state: TournamentConfigState;
  revision: number;
}

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url: url.replace(/\/$/, ""), anonKey } : null;
}

export function hasSupabaseConfig() {
  return Boolean(supabaseConfig());
}

export function readUmpireSession(): UmpireSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as UmpireSession;
    if (!session.token || !session.umpireId || session.expiresAt <= Date.now()) {
      clearUmpireSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveUmpireSession(session: UmpireSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearUmpireSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function readAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const session = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) ?? "null") as AdminSession | null;
    if (!session?.token || session.expiresAt <= Date.now() || session.role !== "admin") {
      clearAdminSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  if (typeof window !== "undefined") sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function readScoringSession(): UmpireSession | AdminSession | null {
  return readAdminSession() ?? readUmpireSession();
}

export async function verifyUmpireCode(code: string) {
  const result = await callFunction<{ token: string; umpireId: string; expiresAt: number }>("verify", { code, access: "umpire" });
  saveUmpireSession(result);
  return result;
}

export async function verifyAdminCode(code: string) {
  const result = await callFunction<AdminSession>("verify", { code, access: "admin" });
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(result));
  return result;
}

export async function fetchRemoteConfig(): Promise<RemoteTournamentConfig | null> {
  const config = supabaseConfig();
  if (!config) return null;
  const response = await fetch(`${config.url}/rest/v1/tournament_config?id=eq.main&select=state,revision`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Could not load tournament settings (${response.status}).`);
  const rows = await response.json() as { state: TournamentConfigState; revision: number }[];
  if (!rows[0]) return null;
  localStorage.setItem(CONFIG_REVISION_KEY, String(rows[0].revision));
  return rows[0];
}

export async function writeRemoteAdminState(previous: AppState, next: AppState) {
  const session = readAdminSession();
  if (!session) throw new Error("Your admin session expired. Re-enter the admin password.");
  const changed = next.matches.filter((match) => JSON.stringify(previous.matches.find((item) => item.id === match.id)) !== JSON.stringify(match));
  const state: TournamentConfigState = {
    tournament: next.tournament,
    players: next.players,
    teams: next.teams,
    courts: next.courts,
    byes: next.byes,
  };
  const result = await callFunction<{ matches: RemoteMatch[]; configRevision: number }>("admin-write", {
    config: { expectedRevision: Number(localStorage.getItem(CONFIG_REVISION_KEY) ?? 0), state },
    updates: changed.map((match) => ({ matchId: match.id, expectedRevision: getMatchRevision(match.id), state: match })),
    releaseMatchIds: changed.filter((match) => match.status === "upcoming").map((match) => match.id),
  }, session.token);
  result.matches?.forEach(rememberRemoteMatch);
  localStorage.setItem(CONFIG_REVISION_KEY, String(result.configRevision));
  return result;
}

export async function claimMatch(matchId: string) {
  const session = requiredScoringSession();
  const result = await callFunction<{ ok: boolean; leaseExpiresAt?: string }>("claim", { matchId, umpireId: session.umpireId }, session.token);
  return result;
}

export async function renewMatchLease(matchId: string) {
  const session = requiredScoringSession();
  return callFunction<{ ok: boolean; leaseExpiresAt?: string }>("renew", { matchId, umpireId: session.umpireId }, session.token);
}

export async function adminReleaseMatch(matchId: string) {
  const session = readAdminSession();
  if (!session) throw new Error("Your admin session expired. Re-enter the admin password.");
  return callFunction<{ ok: boolean }>("admin-release", { matchId }, session.token);
}

export async function heartbeatAccessSession() {
  const session = readScoringSession();
  if (!session) return false;
  await callFunction<{ ok: boolean }>("heartbeat", {}, session.token);
  return true;
}

export async function logoutAccessSession() {
  const sessions = [readUmpireSession(), readAdminSession()].filter((session): session is UmpireSession | AdminSession => Boolean(session));
  await Promise.allSettled(sessions.map((session) => callFunction("logout", {}, session.token)));
}

export function getMatchRevision(matchId: string) {
  if (typeof window === "undefined") return 0;
  return readRevisions()[matchId] ?? 0;
}

export function rememberRemoteMatch(row: RemoteMatch) {
  if (typeof window === "undefined") return;
  const revisions = readRevisions();
  if ((revisions[row.match_id] ?? -1) >= row.revision) return;
  revisions[row.match_id] = row.revision;
  localStorage.setItem(REVISION_KEY, JSON.stringify(revisions));
}

function setRemoteRevision(row: RemoteMatch) {
  if (typeof window === "undefined") return;
  const revisions = readRevisions();
  revisions[row.match_id] = row.revision;
  localStorage.setItem(REVISION_KEY, JSON.stringify(revisions));
}

function readRevisions(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(REVISION_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export async function fetchRemoteMatches(options: { forceRevision?: boolean } = {}): Promise<RemoteMatch[]> {
  const config = supabaseConfig();
  if (!config) return [];
  const response = await fetch(`${config.url}/rest/v1/match_states?select=match_id,state,revision`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Could not load shared match scores (${response.status}).`);
  const rows = (await response.json()) as RemoteMatch[];
  if (options.forceRevision !== false) rows.forEach(setRemoteRevision);
  return rows;
}

export async function writeRemoteMatches(controllerMatchId: string, matches: Match[]) {
  const session = requiredScoringSession();
  const result = await callFunction<{ matches: RemoteMatch[] }>(
    "write",
    {
      controllerMatchId,
      umpireId: session.umpireId,
      updates: matches.map((state) => ({
        matchId: state.id,
        expectedRevision: getMatchRevision(state.id),
        state,
      })),
    },
    session.token,
  );
  result.matches?.forEach(rememberRemoteMatch);
  return result;
}

export function subscribeToRemoteMatches(onRows: (rows: RemoteMatch[]) => void, onStatus: (connected: boolean) => void, onConfig?: (config: RemoteTournamentConfig) => void) {
  const config = supabaseConfig();
  if (!config || typeof WebSocket === "undefined") return () => {};
  let socket: WebSocket | null = null;
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let retry = 0;
  let ref = 0;
  const eventRevisions = new Map<string, number>();
  let reconciling = false;

  const reconcileSnapshot = () => {
    if (reconciling || stopped) return;
    reconciling = true;
    void fetchRemoteMatches({ forceRevision: false }).then((rows) => {
      const latest = rows.filter((row) => row.revision >= (eventRevisions.get(row.match_id) ?? 0));
      latest.forEach(rememberRemoteMatch);
      onRows(latest);
    }).catch(() => undefined).finally(() => { reconciling = false; });
  };

  const connect = () => {
    if (stopped) return;
    const wsUrl = `${config.url.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(config.anonKey)}&vsn=2.0.0`;
    socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      retry = 0;
      socket?.send(JSON.stringify([String(++ref), String(ref), "realtime:public:match_states", "phx_join", {
        config: {
          broadcast: { ack: false, self: false },
          presence: { enabled: false, key: "" },
          postgres_changes: [{ event: "*", filter: "", schema: "public", table: "match_states" }],
          private: false,
        },
        access_token: config.anonKey,
      }]));
      socket?.send(JSON.stringify([String(++ref), String(ref), "realtime:public:tournament_config", "phx_join", {
        config: {
          broadcast: { ack: false, self: false },
          presence: { enabled: false, key: "" },
          postgres_changes: [{ event: "*", filter: "id=eq.main", schema: "public", table: "tournament_config" }],
          private: false,
        },
        access_token: config.anonKey,
      }]));
      heartbeat = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          const heartbeatRef = String(++ref);
          socket.send(JSON.stringify([null, heartbeatRef, "phoenix", "heartbeat", {}]));
        }
      }, 25_000);
    };
    socket.onmessage = (message) => {
      try {
        const packet = JSON.parse(String(message.data)) as unknown[];
        const topic = String(packet[2] ?? "");
        const payload = packet[4] as { data?: { record?: RemoteMatch; type?: string }; record?: RemoteMatch } | undefined;
        if (topic === "realtime:public:tournament_config") {
          const configPayload = packet[4] as { data?: { record?: { id?: string; state?: TournamentConfigState; revision?: number } }; record?: { id?: string; state?: TournamentConfigState; revision?: number } } | undefined;
          const record = configPayload?.data?.record ?? configPayload?.record;
          if (record?.id === "main" && record.state && Number.isFinite(record.revision)) {
            localStorage.setItem(CONFIG_REVISION_KEY, String(record.revision));
            onConfig?.({ state: record.state, revision: record.revision! });
          }
          return;
        }
        if (packet[3] === "phx_reply" && packet[2] === "realtime:public:match_states") {
          const joined = (payload as { status?: string } | undefined)?.status === "ok";
          onStatus(joined);
          if (joined) reconcileSnapshot();
          else socket?.close();
        }
        if (packet[3] === "phx_close" || packet[3] === "phx_error") socket?.close();
        const row = payload?.data?.record ?? payload?.record;
        if (row?.match_id && row.state && Number.isFinite(row.revision)) {
          const latestRevision = Math.max(getMatchRevision(row.match_id), eventRevisions.get(row.match_id) ?? 0);
          if (row.revision <= latestRevision) return;
          eventRevisions.set(row.match_id, row.revision);
          rememberRemoteMatch(row);
          onRows([row]);
        }
      } catch {
        // Ignore protocol messages that do not carry a match row.
      }
    };
    socket.onclose = () => {
      onStatus(false);
      if (heartbeat) clearInterval(heartbeat);
      if (!stopped) {
        const delay = Math.min(30_000, 1000 * 2 ** retry++);
        retryTimer = setTimeout(connect, delay);
      }
    };
    socket.onerror = () => socket?.close();
  };
  connect();
  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (heartbeat) clearInterval(heartbeat);
    socket?.close();
    onStatus(false);
  };
}

async function callFunction<T = void>(operation: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const config = supabaseConfig();
  if (!config) throw new Error("Shared umpire scoring is not configured. Add the Supabase URL and anon key to .env.local.");
  const response = await fetch(`${config.url}/functions/v1/umpire`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ operation, ...body }),
  });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? `Umpire service failed (${response.status}).`);
  return result;
}

function requiredScoringSession() {
  const session = readScoringSession();
  if (!session) throw new Error("Your umpire or admin session expired. Re-enter the access code.");
  return session;
}
