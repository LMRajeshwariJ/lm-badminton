"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTournament } from "@/context/tournament-context";
import {
  clearAdminSession,
  clearUmpireSession,
  hasSupabaseConfig,
  readAdminSession,
  readUmpireSession,
  releaseAllMatches,
  verifyAdminCode,
  verifyUmpireCode,
} from "@/lib/supabase";

export function RoleSwitcher() {
  const { state, dispatch } = useTournament();
  const [requestedRole, setRequestedRole] = useState<"umpire" | "admin" | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const router = useRouter();

  function enter(role: "umpire" | "admin") {
    const active = role === "umpire" ? readUmpireSession() : readAdminSession();
    if (active) {
      dispatch({ type: "SET_ROLE", role });
      router.push(role === "umpire" ? "/umpire" : "/admin");
      return;
    }
    setRequestedRole(role);
    setCode("");
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestedRole) return;
    setVerifying(true);
    setError("");
    try {
      if (requestedRole === "umpire") await verifyUmpireCode(code);
      else await verifyAdminCode(code);
      dispatch({ type: "SET_ROLE", role: requestedRole });
      router.push(requestedRole === "umpire" ? "/umpire" : "/admin");
      setRequestedRole(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The password could not be checked.");
    } finally {
      setVerifying(false);
    }
  }

  function exit() {
    if (state.role === "umpire") void releaseAllMatches();
    clearUmpireSession();
    clearAdminSession();
    dispatch({ type: "SET_ROLE", role: "audience" });
    router.push("/");
  }

  return (
    <div className="flex items-center gap-2">
      {state.role === "audience" ? (
        <>
          <Button variant="ghost" size="sm" onClick={() => enter("umpire")}>Umpire</Button>
          <Button variant="ghost" size="sm" onClick={() => enter("admin")}>Admin</Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" onClick={exit}>Exit {state.role}</Button>
      )}
      {requestedRole ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => event.target === event.currentTarget && setRequestedRole(null)}>
          <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{requestedRole} access</p>
            <h2 className="mt-2 font-display text-3xl">Enter password</h2>
            <p className="mt-2 text-sm text-muted">The session stays in this browser tab for up to 12 hours.</p>
            <form onSubmit={submit} className="mt-5">
              <label className="text-sm font-semibold" htmlFor="access-code">Password</label>
              <input id="access-code" type="password" autoComplete="off" autoFocus value={code} onChange={(event) => setCode(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 outline-none focus:border-accent" disabled={!hasSupabaseConfig() || verifying} />
              {!hasSupabaseConfig() ? <p className="mt-2 text-sm text-sky">Supabase must be configured before protected access can be used.</p> : null}
              {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setRequestedRole(null)}>Cancel</Button>
                <Button type="submit" disabled={!code || verifying || !hasSupabaseConfig()}>{verifying ? "Checking…" : "Continue"}</Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
