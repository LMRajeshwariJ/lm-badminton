"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTournament } from "@/context/tournament-context";
import type { Role } from "@/types";
import { clearUmpireSession, hasSupabaseConfig, readUmpireSession, releaseAllMatches, verifyUmpireCode } from "@/lib/supabase";

const roles: { id: Role; label: string }[] = [
  { id: "audience", label: "Audience" },
  { id: "umpire", label: "Umpire" },
  { id: "admin", label: "Admin" },
];

export function RoleSwitcher() {
  const { state, dispatch } = useTournament();
  const [confirm, setConfirm] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const router = useRouter();

  async function enterUmpire(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifying(true);
    setCodeError("");
    try {
      await verifyUmpireCode(code);
      dispatch({ type: "SET_ROLE", role: "umpire" });
      setCode("");
      setCodeOpen(false);
      router.push("/umpire");
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : "The code could not be checked.");
    } finally {
      setVerifying(false);
    }
  }

  function chooseRole(role: Role) {
    if (role === "umpire") {
      if (readUmpireSession()) {
        dispatch({ type: "SET_ROLE", role: "umpire" });
        router.push("/umpire");
      } else {
        setCodeOpen(true);
      }
      return;
    }
    if (state.role === "umpire") {
      clearUmpireSession();
      dispatch({ type: "SET_ROLE", role: "audience" });
    }
    dispatch({ type: "SET_ROLE", role });
  }

  return (
    <div className="flex items-center gap-2">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Demo role switcher</p>
        <div className="flex rounded-full border border-line bg-surface p-1" role="group" aria-label="Demo role switcher">
          {roles.map((role) => {
            const active = state.role === role.id;
            return (
              <button
                key={role.id}
                type="button"
                aria-pressed={active}
                onClick={() => chooseRole(role.id)}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold sm:px-3 sm:text-xs ${
                  active ? "bg-accent text-[#101608]" : "text-muted hover:text-foreground"
                }`}
              >
                {role.label}
              </button>
            );
          })}
        </div>
      </div>
      <DropdownMenu onOpenChange={() => setConfirm(false)}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Reset demo data">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Not secure authentication. The role is saved only in this browser.</DropdownMenuLabel>
          {confirm ? (
            <DropdownMenuItem
              onSelect={() => {
                dispatch({ type: "RESET" });
                setConfirm(false);
              }}
            >
              Confirm reset of demo data
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setConfirm(true);
              }}
            >
              Reset demo data
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {state.role === "umpire" && readUmpireSession() ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void releaseAllMatches();
            clearUmpireSession();
            dispatch({ type: "SET_ROLE", role: "audience" });
            router.push("/");
          }}
        >
          Exit umpire
        </Button>
      ) : null}
      {codeOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCodeOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="umpire-code-title" className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Umpire access</p>
            <h2 id="umpire-code-title" className="mt-2 font-display text-3xl">Enter access code</h2>
            <p className="mt-2 text-sm text-muted">This shared code opens the scoring dashboard. Your umpire session is limited to this browser tab.</p>
            <form onSubmit={enterUmpire} className="mt-5">
              <label className="text-sm font-semibold" htmlFor="umpire-code">Access code</label>
              <input
                id="umpire-code"
                type="password"
                autoComplete="off"
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 outline-none focus:border-accent"
                disabled={!hasSupabaseConfig() || verifying}
              />
              {!hasSupabaseConfig() ? <p className="mt-2 text-sm text-sky">Shared scoring is not configured yet. Follow the Supabase setup in the README.</p> : null}
              {codeError ? <p role="alert" className="mt-2 text-sm text-danger">{codeError}</p> : null}
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setCodeOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!hasSupabaseConfig() || !code || verifying}>{verifying ? "Checking…" : "Continue"}</Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
