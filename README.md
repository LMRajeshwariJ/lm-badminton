# LM-Badminton

Office badminton tournament site for mixed doubles and women's singles. The tournament participants, courts, and draw are configured in `src/data`. Match progress is shared through Supabase when configured; without Supabase the public demo remains available from the browser's local seed data, but umpire writes are disabled.

## Local development

Requirements: Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY if a Supabase project is configured.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Umpire access is disabled until Supabase is configured. `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` are available.

## Supabase setup

The browser contains only the project URL and public anon key. It can read `match_states` under RLS. All writes, code verification, rate limiting, lease management, and revision checks run through the `umpire` Edge Function using the server-side service role key. Never put the service role key in `.env.local`, Vercel variables, or client code.

1. Create a Supabase project and install/use the Supabase CLI. Link this repository to the project.

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

2. Create a high-entropy shared umpire code and generate its server-side HMAC hash and pepper:

   ```bash
   node scripts/hash-umpire-code.mjs
   ```

   Enter the code at the prompt. Store the printed `UMPIRE_CODE_PEPPER` and `UMPIRE_ACCESS_CODE_HASH` in a password manager temporarily. The raw code is not written to a file or sent by this script.

3. Generate `UMPIRE_SESSION_SECRET` with `openssl rand -hex 32`. Set all three secrets in Supabase. Use the exact pepper/hash printed in step 2.

   ```bash
   npx supabase secrets set \
     UMPIRE_CODE_PEPPER='...' \
     UMPIRE_ACCESS_CODE_HASH='...' \
     UMPIRE_SESSION_SECRET='...'
   npx supabase functions deploy umpire
   ```

   Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function runtime. If your project does not expose these defaults, configure them as Edge Function secrets in the Supabase dashboard. The Function has `verify_jwt = false` because it validates its own short-lived HMAC-signed umpire session token.

4. Copy the project's URL and anon key from Supabase API settings into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```

   Restart `npm run dev`. Apply the same two public values as Vercel environment variables for Production and Preview when deploying.

The migration creates one row per match, a private two-minute match lease, and a private rate-limit table. Public clients can select match rows but cannot insert/update/delete them. The Edge Function validates a 12-hour session, limits failed access-code attempts to 10 per IP hash per 15-minute window, checks the active match lease, and uses expected revisions for atomic writes. A point updates its match and any bracket slot it advances in one database transaction. Realtime publishes changed match rows; clients reconnect with backoff and reject stale revisions.

## Scoring behavior

- Best of three; a game requires the configured target and a two-point lead, with the configured cap ending a game.
- Rally points and recorded service/other faults both use the same scoring action and timeline.
- Singles service court is derived from the serving player's score parity. Doubles tracks each pair's right/left player positions. The serving pair swaps positions when it wins a point on serve; a receiving pair takes service from the player in the court matching its score parity.
- At match start, the umpire chooses the serving side and, for doubles, first server and receiver in the right court.
- Undo restores score, serve, player positions, game/match state, and bracket advancement. Undo is blocked if the advanced next match has started, which avoids silently corrupting a downstream result.
- A lease expires after two minutes without renewal. The scoring screen renews it every 30 seconds. A different umpire can reclaim it after expiration.

## Tests and checks

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

The tests exercise badminton score thresholds, start/pause/resume, fault logging, doubles service rotation, undo, completion, and bracket advancement. Cross-device realtime, Edge Function authorization, and lease races require a configured Supabase project and should also be checked using the manual steps below.

## Manual test: two umpires and a spectator

Use three separate browser profiles (and optionally a phone), all pointed at the same deployment or dev server. Make sure Supabase is configured first.

1. In Browser 1, choose **Umpire**, enter an invalid code and confirm it is rejected. Enter the correct code and open the Umpire desk.
2. Start a scheduled match. Confirm the details, choose Court 1, pick the first serving side/player, and begin scoring. It should open the full-screen console and appear on the public Live page.
3. In Browser 2, enter the umpire code and start a different scheduled match on Court 2. Award points in both consoles and confirm the scores advance independently.
4. Open Browser 3 to `/live`. Confirm both courts appear. Award a point in Browser 1 and verify Browser 3 updates without refresh. Open a match detail page and verify the current score, server, game scores, and history.
5. Record an other fault and a service fault. Confirm the opponent receives one point and the reason appears in history. Undo each and check the score and serving position return.
6. Pause and resume one match. Refresh its console; it should recover the latest score. Leave Browser 2 idle for over two minutes in a separate check, then reclaim the match from another umpire; an unexpired lease should prevent takeover.
7. Score through a game and then a match. Confirm game winner, completion state, result visibility, bracket advancement, and standings. Undo the match-winning point before the next match starts and confirm the bracket slot clears. After the next match has started, confirm undo is blocked.
8. Disconnect one spectator browser from the network, score additional points, reconnect, and confirm it receives the latest database score after the Realtime reconnect. Refresh the spectator page midway through another game and confirm it loads the saved current score.
9. In a separate browser, attempt a direct REST write with the anon key and confirm RLS denies it. Try repeated wrong codes and confirm the endpoint rate-limits further checks.

## Vercel deployment

Import the repository into Vercel, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then deploy. Deployments do not reset match progress because Supabase holds the mutable match rows. App Router nested routes such as `/live/<matchId>` and `/umpire/match/<matchId>` are handled by Next.js; no custom rewrite is required.

Check the current account terms before using Vercel Hobby for an office or organizational tournament: Hobby is restricted to personal, non-commercial use. See [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby) and [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines).

Supabase's published Free plan currently includes 2 million Realtime messages, 200 peak Realtime connections, 500,000 Edge Function invocations, and a 500 MB database quota. A tournament with a small audience and a few courts should be modest, but reconnecting spectators increase Realtime messages. Verify current [Supabase billing limits](https://supabase.com/docs/guides/platform/billing-on-supabase) and [Realtime limits](https://supabase.com/docs/guides/realtime/limits) before the event; providers can change quotas and eligibility.

## Current limits

- The tournament roster and bracket topology remain hardcoded in `src/data`; bracket edits are not managed through the umpire UI.
- This shared access code is suitable for a small event, not identity-grade authentication. Anyone who knows it can authorize a browser until their session expires.
- Match leases recover after two minutes, so a device that loses connectivity may briefly hold a lease until expiry.
- Browser-side Realtime uses Supabase's Phoenix WebSocket protocol v2 directly. If Supabase changes that protocol, update the subscription adapter in `src/lib/supabase.ts`.
- Deployment remains a manual operator action. No Supabase project or Vercel deployment is configured by this repository alone.
