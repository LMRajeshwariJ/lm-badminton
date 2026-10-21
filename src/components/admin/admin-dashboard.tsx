"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTournament } from "@/context/tournament-context";
import { CATEGORY_META, ROUND_LABEL } from "@/lib/constants";
import { playTournamentSound } from "@/lib/experience";
import { adminReleaseMatch, readAdminSession } from "@/lib/supabase";
import type { CategoryId, ExperienceSettings, Match, Player, RoundId, Team } from "@/types";

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
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Manage</h1>
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
          <TabsTrigger value="experience">Sound & animations</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <section className="grid gap-4 rounded-3xl border border-line bg-surface p-5 sm:grid-cols-2">
            <Field label="Tournament name" value={details.name} onChange={(name) => setDetails({ ...details, name })} />
            <Field label="Edition" value={details.edition} onChange={(edition) => setDetails({ ...details, edition })} />
            <Field label="Start date" type="date" value={details.startDate} onChange={(startDate) => setDetails({ ...details, startDate })} />
            <Field label="End date" type="date" value={details.endDate} onChange={(endDate) => setDetails({ ...details, endDate })} />
            <Field label="Venue" value={details.venue} onChange={(venue) => setDetails({ ...details, venue })} />
            <Field label="Map link" value={details.venueUrl} onChange={(venueUrl) => setDetails({ ...details, venueUrl })} />
            <Field label="City" value={details.city} onChange={(city) => setDetails({ ...details, city })} />
            <label className="sm:col-span-2"><span className="text-sm font-semibold">Description</span><textarea value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-line bg-background px-3 py-2" /></label>
            <div className="sm:col-span-2"><Button disabled={syncPending} onClick={() => dispatch({ type: "UPDATE_TOURNAMENT", patch: details })}>Save details</Button></div>
          </section>
        </TabsContent>

        <TabsContent value="entries">
          <div className="space-y-6">
            {(["mixed-doubles", "womens-singles"] as CategoryId[]).map((category) => (
              <EntryEditor
                key={category}
                category={category}
                teams={state.teams}
                players={state.players}
                matches={state.matches}
                disabled={syncPending}
                onCreate={(team, players) => dispatch({ type: "ADD_TEAM", team, players })}
                onSave={(team, players) => dispatch({ type: "UPDATE_TEAM", team, players })}
                onDelete={(teamId) => dispatch({ type: "DELETE_TEAM", teamId })}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="draw">
          <div className="space-y-6">
            {(["mixed-doubles", "womens-singles"] as CategoryId[]).map((category) => (
              <section key={category} className="rounded-3xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-2xl">{CATEGORY_META[category].label}</h2>
                  <Button variant="outline" disabled={syncPending} onClick={() => dispatch({ type: "RESET_CATEGORY", category })}>Reset category</Button>
                </div>
                <CreateMatchForm category={category} teams={state.teams} matches={state.matches} disabled={syncPending} onCreate={(match) => dispatch({ type: "CREATE_FIXTURE", match })} />
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
                        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="ghost" disabled={syncPending} onClick={() => dispatch({ type: "RESET_MATCH", matchId: match.id })}>Reset</Button><Button size="sm" variant="outline" disabled={syncPending} onClick={() => void adminReleaseMatch(match.id).then(() => setAccessMessage(`${match.id} is available for another umpire.`)).catch((error: unknown) => setAccessMessage(error instanceof Error ? error.message : "Could not release match ownership."))}>Release umpire</Button><Button size="sm" variant="outline" className="border-danger text-danger" disabled={syncPending || match.status !== "upcoming"} onClick={() => dispatch({ type: "DELETE_FIXTURE", matchId: match.id })}>Delete</Button></div>
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
              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <RuleForm label="All categories" initial={{ pointsPerGame: 15, maxPoints: 21, bestOf: 3 }} disabled={syncPending} onSave={(rules) => dispatch({ type: "UPDATE_SCORING_RULES", ...rules })} />
                {(["mixed-doubles", "womens-singles"] as CategoryId[]).map((category) => <RuleForm key={category} label={CATEGORY_META[category].label} initial={CATEGORY_META[category]} disabled={syncPending} onSave={(rules) => dispatch({ type: "UPDATE_SCORING_RULES", category, ...rules })} />)}
              </div>
            </section>
            <section className="rounded-3xl border border-line bg-surface p-5">
              <h2 className="font-display text-2xl">Specific match rules</h2>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {state.matches.map((match) => <MatchRuleForm key={`${match.id}:${match.pointsPerGame}:${match.maxPoints}:${match.bestOf}`} match={match} disabled={syncPending || match.status !== "upcoming"} onSave={(rules) => dispatch({ type: "UPDATE_FIXTURE", matchId: match.id, patch: rules })} />)}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="experience">
          <ExperienceSettingsEditor settings={state.experienceSettings} disabled={syncPending} onSave={(settings) => dispatch({ type: "UPDATE_EXPERIENCE_SETTINGS", settings })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExperienceSettingsEditor({ settings, disabled, onSave }: { settings: ExperienceSettings; disabled: boolean; onSave: (settings: ExperienceSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const toggle = (key: keyof ExperienceSettings) => setDraft({ ...draft, [key]: !draft[key] });
  return <section className="rounded-3xl border border-line bg-surface p-5"><h2 className="font-display text-2xl">Sound & animations</h2><div className="mt-5 grid gap-5 lg:grid-cols-2"><div><h3 className="font-semibold">Sound</h3><div className="mt-3 space-y-2">{([['masterSound', 'Master Sound'], ['pointSound', 'Point Sound'], ['gameSound', 'Game Victory Sound'], ['matchSound', 'Match Victory Sound'], ['championSound', 'Champion Sound']] as Array<[keyof ExperienceSettings, string]>).map(([key, label]) => <ToggleRow key={key} label={label} checked={Boolean(draft[key])} onChange={() => toggle(key)} />)}</div><label className="mt-4 block text-sm font-semibold">Volume · {draft.volume}%<input type="range" min={0} max={100} value={draft.volume} onChange={(event) => setDraft({ ...draft, volume: Number(event.target.value) })} className="mt-2 w-full accent-[var(--accent)]" /></label><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => playTournamentSound("point", draft, false, true)}>Test sound</Button></div><div><h3 className="font-semibold">Animations</h3><div className="mt-3 space-y-2">{([['animations', 'Enable Animations'], ['confetti', 'Enable Confetti'], ['victoryCelebrations', 'Enable Victory Celebrations']] as Array<[keyof ExperienceSettings, string]>).map(([key, label]) => <ToggleRow key={key} label={label} checked={Boolean(draft[key])} onChange={() => toggle(key)} />)}</div></div></div><Button className="mt-6" disabled={disabled} onClick={() => onSave(draft)}>{disabled ? "Saving…" : "Save experience settings"}</Button></section>;
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-background px-3 py-2.5 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--accent)]" /></label>;
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

function EntryEditor({ category, teams, players, matches, disabled, onCreate, onSave, onDelete }: { category: CategoryId; teams: Team[]; players: Player[]; matches: Match[]; disabled: boolean; onCreate: (team: Team, players: Player[]) => void; onSave: (team: Team, players: Player[]) => void; onDelete: (teamId: string) => void }) {
  const entries = teams.filter((team) => team.category === category);
  return <section className="rounded-3xl border border-line bg-surface p-5"><h2 className="font-display text-2xl">{CATEGORY_META[category].label}</h2><CreateEntryForm category={category} nextSeed={entries.length + 1} disabled={disabled} onCreate={onCreate} /><div className="mt-4 grid gap-3 lg:grid-cols-2">{entries.map((team) => { const members = players.filter((player) => team.playerIds.includes(player.id)); const locked = matches.some((match) => (match.homeId === team.id || match.awayId === team.id) && match.status !== "upcoming"); return <EntryRow key={`${team.id}:${team.name}:${members.map((player) => player.name).join(":")}`} team={team} players={members} disabled={disabled} deleteDisabled={locked} onSave={onSave} onDelete={onDelete} />; })}</div></section>;
}

function EntryRow({ team, players, disabled, deleteDisabled, onSave, onDelete }: { team: Team; players: Player[]; disabled: boolean; deleteDisabled: boolean; onSave: (team: Team, players: Player[]) => void; onDelete: (teamId: string) => void }) {
  const [name, setName] = useState(team.name);
  const [names, setNames] = useState(players.map((player) => player.name));
  return <article className="rounded-2xl border border-line bg-background p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{team.id}</p><input aria-label={`${team.id} team name`} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 font-semibold" />{players.map((player, index) => <input key={player.id} aria-label={`${team.id} player ${index + 1}`} value={names[index] ?? ""} onChange={(event) => setNames(names.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" />)}<div className="mt-3 flex gap-2"><Button size="sm" disabled={disabled || !name.trim() || names.some((item) => !item.trim())} onClick={() => onSave({ ...team, name: name.trim() }, players.map((player, index) => ({ ...player, name: names[index].trim() })))}>Save</Button><Button size="sm" variant="outline" className="border-danger text-danger" disabled={disabled || deleteDisabled} title={deleteDisabled ? "Reset active or completed matches before deleting this entry." : "Delete entry and players"} onClick={() => onDelete(team.id)}>Delete</Button></div></article>;
}

function CreateEntryForm({ category, nextSeed, disabled, onCreate }: { category: CategoryId; nextSeed: number; disabled: boolean; onCreate: (team: Team, players: Player[]) => void }) {
  const playerCount = category === "mixed-doubles" ? 2 : 1;
  const [teamName, setTeamName] = useState("");
  const [playerNames, setPlayerNames] = useState<string[]>(Array(playerCount).fill(""));
  const create = () => {
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const teamId = `${category === "mixed-doubles" ? "MD" : "WS"}-CUSTOM-${suffix}`;
    const newPlayers = playerNames.map((name, index) => ({ id: `${teamId}-P${index + 1}`, name: name.trim(), department: "" }));
    onCreate({ id: teamId, name: (category === "womens-singles" ? playerNames[0] : teamName).trim(), category, playerIds: newPlayers.map((player) => player.id), seed: nextSeed }, newPlayers);
    setTeamName("");
    setPlayerNames(Array(playerCount).fill(""));
  };
  const valid = playerNames.every((name) => name.trim()) && (category === "womens-singles" || teamName.trim());
  return <div className="mt-4 rounded-2xl border border-dashed border-line bg-background p-4"><p className="font-semibold">Add entry</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{category === "mixed-doubles" ? <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name" className="rounded-lg border border-line bg-surface px-3 py-2" /> : null}{playerNames.map((name, index) => <input key={index} value={name} onChange={(event) => setPlayerNames(playerNames.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Player ${index + 1}`} className="rounded-lg border border-line bg-surface px-3 py-2" />)}</div><Button className="mt-3" size="sm" disabled={disabled || !valid} onClick={create}>Add</Button></div>;
}

function CreateMatchForm({ category, teams, matches, disabled, onCreate }: { category: CategoryId; teams: Team[]; matches: Match[]; disabled: boolean; onCreate: (match: Match) => void }) {
  const [round, setRound] = useState<RoundId>(category === "mixed-doubles" ? "round-of-16" : "preliminary");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const options = teams.filter((team) => team.category === category);
  const create = () => {
    const id = `${category === "mixed-doubles" ? "MD" : "WS"}-CUSTOM-${Date.now().toString(36).toUpperCase()}`;
    const meta = CATEGORY_META[category];
    onCreate({ id, category, round, status: "upcoming", homeId, awayId, courtId: null, scheduledAt: null, pointsPerGame: meta.pointsPerGame, maxPoints: meta.maxPoints, bestOf: meta.bestOf, winBy: 2, games: [], serving: null, servingPlayerId: null, positions: {}, winnerId: null, startedAt: null, completedAt: null, nextMatchId: null, nextSlot: null, paused: false, timeline: [], history: [] });
    setHomeId(""); setAwayId("");
  };
  const occupied = matches.some((match) => match.category === category && match.round === round && ((match.homeId && match.homeId === homeId) || (match.awayId && match.awayId === homeId) || (match.homeId && match.homeId === awayId) || (match.awayId && match.awayId === awayId)));
  return <div className="mt-4 rounded-2xl border border-dashed border-line bg-background p-4"><p className="font-semibold">Add match</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><select value={round} onChange={(event) => setRound(event.target.value as RoundId)} className="rounded-lg border border-line bg-surface px-3 py-2">{Object.entries(ROUND_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><ParticipantSelect value={homeId || null} options={options} disabled={disabled} onChange={(value) => setHomeId(value ?? "")} /><ParticipantSelect value={awayId || null} options={options} disabled={disabled} onChange={(value) => setAwayId(value ?? "")} /></div>{occupied ? <p className="mt-2 text-xs text-danger">A selected team already has a match in this round.</p> : null}<Button className="mt-3" size="sm" disabled={disabled || !homeId || !awayId || homeId === awayId || occupied} onClick={create}>Add match</Button></div>;
}

function ParticipantSelect({ value, options, disabled, onChange }: { value: string | null; options: Team[]; disabled: boolean; onChange: (value: string | null) => void }) {
  return <select value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value || null)} className="min-w-0 rounded-lg border border-line bg-surface px-2 py-2 text-sm"><option value="">To be decided</option>{options.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>;
}
