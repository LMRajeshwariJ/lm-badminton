"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTournament } from "@/context/tournament-context";
import { CATEGORY_META, ROUND_LABEL } from "@/lib/constants";
import { adminReleaseMatch, readAdminSession } from "@/lib/supabase";
import type { CategoryId, Match, Player, Team } from "@/types";

export function AdminDashboard() {
  const { state, dispatch, syncPending, syncError } = useTournament();
  const [details, setDetails] = useState(state.tournament);
  const [accessMessage, setAccessMessage] = useState("");
  const authorized = state.role === "admin" && Boolean(readAdminSession());

  if (!authorized) {
    return <div className="mx-auto max-w-3xl px-4 py-16"><h1 className="font-display text-4xl">Admin access required</h1><p className="mt-3 text-muted">Choose Admin in the header and enter the admin password.</p></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Tournament management</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Manage</h1>
        <p className="mt-3 text-muted">Edit tournament details, scoring rules, draw slots, and reset results when a match must be replayed.</p>
        <div className="mt-5 flex flex-wrap gap-2"><Button asChild><Link href="/umpire">Open scoring desk</Link></Button><Button asChild variant="outline"><Link href="/admin/practice">Practice scoring</Link></Button></div>
        {syncPending ? <p className="mt-3 text-sm text-sky">Saving…</p> : null}
        {syncError ? <p className="mt-3 text-sm text-danger">{syncError}</p> : null}
        {accessMessage ? <p className="mt-3 text-sm text-sky">{accessMessage}</p> : null}
      </header>

      <Tabs defaultValue="details" className="mt-8">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="entries">Teams & players</TabsTrigger>
          <TabsTrigger value="draw">Draw & resets</TabsTrigger>
          <TabsTrigger value="scoring">Scoring rules</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <section className="grid gap-4 rounded-3xl border border-line bg-surface p-5 sm:grid-cols-2">
            <Field label="Tournament name" value={details.name} onChange={(name) => setDetails({ ...details, name })} />
            <Field label="Edition" value={details.edition} onChange={(edition) => setDetails({ ...details, edition })} />
            <Field label="Start date" type="date" value={details.startDate} onChange={(startDate) => setDetails({ ...details, startDate })} />
            <Field label="End date" type="date" value={details.endDate} onChange={(endDate) => setDetails({ ...details, endDate })} />
            <Field label="Venue" value={details.venue} onChange={(venue) => setDetails({ ...details, venue })} />
            <Field label="City" value={details.city} onChange={(city) => setDetails({ ...details, city })} />
            <label className="sm:col-span-2"><span className="text-sm font-semibold">Description</span><textarea value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-line bg-background px-3 py-2" /></label>
            <div className="sm:col-span-2"><Button disabled={syncPending} onClick={() => dispatch({ type: "UPDATE_TOURNAMENT", patch: details })}>Save details</Button></div>
          </section>
        </TabsContent>

        <TabsContent value="entries">
          <div className="space-y-6">
            {(["mixed-doubles", "womens-singles"] as CategoryId[]).map((category) => (
              <EntryEditor key={category} category={category} teams={state.teams} players={state.players} disabled={syncPending} onSave={(team, players) => dispatch({ type: "UPDATE_TEAM", team, players })} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="draw">
          <div className="space-y-6">
            {(["mixed-doubles", "womens-singles"] as CategoryId[]).map((category) => (
              <section key={category} className="rounded-3xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="font-display text-2xl">{CATEGORY_META[category].label}</h2><p className="text-sm text-muted">Only upcoming matches can have their participants changed.</p></div>
                  <Button variant="outline" disabled={syncPending} onClick={() => dispatch({ type: "RESET_CATEGORY", category })}>Reset category</Button>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {state.matches.filter((match) => match.category === category).map((match) => {
                    const options = state.teams.filter((team) => team.category === category);
                    return (
                      <article key={match.id} className="rounded-2xl border border-line bg-background p-4">
                        <div className="flex items-center justify-between gap-2"><p className="font-semibold">{match.id} · {ROUND_LABEL[match.round]}</p><span className="text-xs uppercase text-muted">{match.status}</span></div>
                        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <ParticipantSelect value={match.homeId} options={options} disabled={match.status !== "upcoming" || syncPending} onChange={(homeId) => dispatch({ type: "UPDATE_FIXTURE", matchId: match.id, patch: { homeId } })} />
                          <span className="text-xs text-muted">vs</span>
                          <ParticipantSelect value={match.awayId} options={options} disabled={match.status !== "upcoming" || syncPending} onChange={(awayId) => dispatch({ type: "UPDATE_FIXTURE", matchId: match.id, patch: { awayId } })} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="ghost" disabled={syncPending} onClick={() => dispatch({ type: "RESET_MATCH", matchId: match.id })}>Reset match and dependent results</Button><Button size="sm" variant="outline" disabled={syncPending} onClick={() => void adminReleaseMatch(match.id).then(() => setAccessMessage(`${match.id} is available for another umpire.`)).catch((error: unknown) => setAccessMessage(error instanceof Error ? error.message : "Could not release match ownership."))}>Release umpire ownership</Button></div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
            <Button variant="outline" className="border-danger text-danger" disabled={syncPending} onClick={() => dispatch({ type: "RESET" })}>Reset entire tournament</Button>
          </div>
        </TabsContent>

        <TabsContent value="scoring">
          <div className="space-y-6">
            <section className="rounded-3xl border border-line bg-surface p-5">
              <h2 className="font-display text-2xl">Rules for upcoming matches</h2>
              <p className="mt-1 text-sm text-muted">Apply one format to all upcoming matches or set each category separately. Live and completed matches keep their rules.</p>
              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <RuleForm label="All categories" initial={{ pointsPerGame: 15, maxPoints: 21, bestOf: 3 }} disabled={syncPending} onSave={(rules) => dispatch({ type: "UPDATE_SCORING_RULES", ...rules })} />
                {(["mixed-doubles", "womens-singles"] as CategoryId[]).map((category) => <RuleForm key={category} label={CATEGORY_META[category].label} initial={CATEGORY_META[category]} disabled={syncPending} onSave={(rules) => dispatch({ type: "UPDATE_SCORING_RULES", category, ...rules })} />)}
              </div>
            </section>
            <section className="rounded-3xl border border-line bg-surface p-5">
              <h2 className="font-display text-2xl">Specific match rules</h2>
              <p className="mt-1 text-sm text-muted">Only upcoming matches can be changed.</p>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {state.matches.map((match) => <MatchRuleForm key={`${match.id}:${match.pointsPerGame}:${match.maxPoints}:${match.bestOf}`} match={match} disabled={syncPending || match.status !== "upcoming"} onSave={(rules) => dispatch({ type: "UPDATE_FIXTURE", matchId: match.id, patch: rules })} />)}
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type RuleValues = Pick<Match, "pointsPerGame" | "maxPoints" | "bestOf">;

function RuleForm({ label, initial, disabled, onSave }: { label: string; initial: RuleValues; disabled: boolean; onSave: (rules: RuleValues) => void }) {
  const [rules, setRules] = useState<RuleValues>({ pointsPerGame: initial.pointsPerGame, maxPoints: initial.maxPoints, bestOf: initial.bestOf });
  const valid = rules.pointsPerGame >= 1 && rules.maxPoints >= rules.pointsPerGame && [1, 3, 5].includes(rules.bestOf);
  return <article className="rounded-2xl border border-line bg-background p-4"><p className="font-semibold">{label}</p><RuleInputs rules={rules} setRules={setRules} disabled={disabled} /><Button className="mt-3" size="sm" disabled={disabled || !valid} onClick={() => onSave(rules)}>Apply</Button></article>;
}

function MatchRuleForm({ match, disabled, onSave }: { match: Match; disabled: boolean; onSave: (rules: RuleValues) => void }) {
  const [rules, setRules] = useState<RuleValues>({ pointsPerGame: match.pointsPerGame, maxPoints: match.maxPoints, bestOf: match.bestOf });
  const valid = rules.pointsPerGame >= 1 && rules.maxPoints >= rules.pointsPerGame && [1, 3, 5].includes(rules.bestOf);
  return <article className="rounded-2xl border border-line bg-background p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{match.id} · {ROUND_LABEL[match.round]}</p><span className="text-xs uppercase text-muted">{match.status}</span></div><RuleInputs rules={rules} setRules={setRules} disabled={disabled} /><Button className="mt-3" size="sm" disabled={disabled || !valid} onClick={() => onSave(rules)}>Save match rules</Button></article>;
}

function RuleInputs({ rules, setRules, disabled }: { rules: RuleValues; setRules: (rules: RuleValues) => void; disabled: boolean }) {
  const input = "mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm";
  return <div className="mt-3 grid grid-cols-3 gap-2"><label className="text-xs text-muted">Points<input type="number" min={1} max={99} disabled={disabled} value={rules.pointsPerGame} onChange={(event) => setRules({ ...rules, pointsPerGame: Number(event.target.value) })} className={input} /></label><label className="text-xs text-muted">Cap<input type="number" min={1} max={99} disabled={disabled} value={rules.maxPoints} onChange={(event) => setRules({ ...rules, maxPoints: Number(event.target.value) })} className={input} /></label><label className="text-xs text-muted">Best of<select disabled={disabled} value={rules.bestOf} onChange={(event) => setRules({ ...rules, bestOf: Number(event.target.value) })} className={input}><option value={1}>1</option><option value={3}>3</option><option value={5}>5</option></select></label></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><span className="text-sm font-semibold">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-background px-3 py-2" /></label>;
}

function EntryEditor({ category, teams, players, disabled, onSave }: { category: CategoryId; teams: Team[]; players: Player[]; disabled: boolean; onSave: (team: Team, players: Player[]) => void }) {
  return <section className="rounded-3xl border border-line bg-surface p-5"><h2 className="font-display text-2xl">{CATEGORY_META[category].label}</h2><div className="mt-4 grid gap-3 lg:grid-cols-2">{teams.filter((team) => team.category === category).map((team) => { const members = players.filter((player) => team.playerIds.includes(player.id)); return <EntryRow key={`${team.id}:${team.name}:${members.map((player) => player.name).join(":")}`} team={team} players={members} disabled={disabled} onSave={onSave} />; })}</div></section>;
}

function EntryRow({ team, players, disabled, onSave }: { team: Team; players: Player[]; disabled: boolean; onSave: (team: Team, players: Player[]) => void }) {
  const [name, setName] = useState(team.name);
  const [names, setNames] = useState(players.map((player) => player.name));
  return <article className="rounded-2xl border border-line bg-background p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{team.id}</p><input aria-label={`${team.id} team name`} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 font-semibold" />{players.map((player, index) => <input key={player.id} aria-label={`${team.id} player ${index + 1}`} value={names[index] ?? ""} onChange={(event) => setNames(names.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" />)}<Button className="mt-3" size="sm" disabled={disabled || !name.trim() || names.some((item) => !item.trim())} onClick={() => onSave({ ...team, name: name.trim() }, players.map((player, index) => ({ ...player, name: names[index].trim() })))}>Save entry</Button></article>;
}

function ParticipantSelect({ value, options, disabled, onChange }: { value: string | null; options: Team[]; disabled: boolean; onChange: (value: string | null) => void }) {
  return <select value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value || null)} className="min-w-0 rounded-lg border border-line bg-surface px-2 py-2 text-sm"><option value="">To be decided</option>{options.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>;
}
