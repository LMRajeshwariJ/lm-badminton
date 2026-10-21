# LM-Badminton

Office badminton tournament site for mixed doubles and women's singles. The default participants and draw are configured in `src/data`. Match progress and admin changes are shared through Supabase when configured; without Supabase the public draw remains readable, but protected writes are disabled.

## Guides

- [User guide](docs/USER_GUIDE.md)
- [Developer guide](docs/DEVELOPER_GUIDE.md)

## Local development

Requirements: Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY if a Supabase project is configured.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Umpire and admin access are disabled until Supabase is configured. The two `NEXT_PUBLIC_*` values are safe browser credentials; they identify the project but cannot bypass Row Level Security.

### Sharing the repository with another person

Share the Git repository and `.env.example`. Do **not** share or commit `.env.local`, `.env.admin.local`, `.env.supabase.local`, the Supabase service-role key, database password, session secret, code peppers, or password hashes.

For a collaborator who should use the same tournament database:

1. They run `npm install` and copy `.env.example` to `.env.local`.
2. Send them only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. These may also be copied from the Vercel project settings.
3. Send the umpire or admin password separately through a private channel. Never add either password to an environment file or source code.
4. They run `npm run dev`. Their local scoring changes affect the same live tournament, so use the practice scorer at `/admin/practice` for harmless checks.

For an independent copy, the other person should create their own Supabase project and follow the setup below. This keeps their local testing and deployment separate from your tournament.

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

4. Admin access uses the same server-side HMAC structure with separate credentials. Generate another hash with `node scripts/hash-umpire-code.mjs`, entering the chosen admin password. Put the printed values in an ignored `.env.admin.local` file under these names:

   ```dotenv
   ADMIN_CODE_PEPPER=THE_PRINTED_UMPIRE_CODE_PEPPER_VALUE
   ADMIN_ACCESS_CODE_HASH=THE_PRINTED_UMPIRE_ACCESS_CODE_HASH_VALUE
   ```

   Then upload and deploy:

   ```bash
   npx supabase secrets set --env-file .env.admin.local
   npx supabase db push
   npx supabase functions deploy umpire
   ```

   The plaintext admin password is never committed or stored in Supabase.

5. Copy the project's URL and anon key from Supabase API settings into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```

   Restart `npm run dev`. Apply the same two public values as Vercel environment variables for Production and Preview when deploying.

The migrations create one row per changed match and one compact tournament-configuration row, plus private match ownership and rate-limit data. The roster and initial draw remain hardcoded; Supabase stores live score changes, admin overrides, and global sound/animation switches. Public clients can read these rows but cannot write them. The Edge Function validates role-specific signed sessions, checks match ownership, and uses expected revisions for atomic writes. Realtime publishes match and configuration changes. The stateless shared-code flow comfortably supports roughly ten simultaneous scoring devices without maintaining an active-session registry.

## Scoring behavior

- Admins can set the point target, point cap, and best-of-one/three/five format for all upcoming matches, a category, or one upcoming match.
- A game requires the configured target and a two-point lead, with the configured cap ending a game.
- Umpires award points manually. Undo restores the score, service state, and player positions.
- Singles service court is derived from the serving player's score parity. Doubles tracks each pair's right/left player positions. The serving pair swaps positions when it wins a point on serve; a receiving pair takes service from the player in the court matching its score parity.
- At match start, the umpire chooses the serving side and, for doubles, first server and receiver in the right court.
- Undo restores score, serve, player positions, game/match state, and bracket advancement. Undo is blocked if the advanced next match has started, which avoids silently corrupting a downstream result.
- The umpire who starts a match remains its owner and is the only umpire who can change it. An admin can score any match and can reset results when ownership needs intervention.
- `/admin/practice` starts isolated random matches for checking scoring. Practice scores never write to Supabase or affect the draw.
- Score and victory sounds use the Web Audio API. Umpire mute and spectator notification preferences stay in `localStorage`; global sound and animation settings share the existing configuration record.

## Tests and checks

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

The tests exercise badminton score thresholds, start/pause/resume, manual scoring, doubles service rotation, undo, completion, and bracket advancement. Cross-device realtime, Edge Function authorization, and ownership races require a configured Supabase project and should also be checked using the manual steps below.

## Manual test: two umpires and a spectator

Use three separate browser profiles (and optionally a phone), all pointed at the same deployment or dev server. Make sure Supabase is configured first.

1. In Browser 1, choose **Umpire**, enter an invalid code and confirm it is rejected. Enter the correct code and open the Umpire desk.
2. Start a scheduled match. Confirm the details, choose Court 1, pick the first serving side/player, and begin scoring. It should open the full-screen console and appear on the public Live page.
3. In Browser 2, enter the umpire code and start a different scheduled match on Court 2. Award points in both consoles and confirm the scores advance independently. Repeat across the available devices; the design targets roughly ten simultaneous scorers on different matches.
4. Open Browser 3 to `/live`. Confirm both courts appear. Award a point in Browser 1 and verify Browser 3 updates without refresh. Open a match detail page and verify the current score, server, game scores, and history.
5. Mute one umpire device, award points on both devices, and confirm only that device stays silent. Undo a point and check the score and serving position return.
6. Pause and resume one match. Refresh its console; it should recover the latest score. Try the match from another umpire session and confirm it stays read-only. Sign in as admin and confirm the admin can override it.
7. Score through a game and then a match. Confirm game winner, completion state, result visibility, bracket advancement, and standings. Undo the match-winning point before the next match starts and confirm the bracket slot clears. After the next match has started, confirm undo is blocked.
8. Disconnect one spectator browser from the network, score additional points, reconnect, and confirm it receives the latest database score after the Realtime reconnect. Refresh the spectator page midway through another game and confirm it loads the saved current score.
9. In a separate browser, attempt a direct REST write with the anon key and confirm RLS denies it. Try repeated wrong codes and confirm the endpoint rate-limits further checks.

## Vercel deployment

Import the repository into Vercel, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then deploy. Deployments do not reset match progress because Supabase holds the mutable match rows. App Router nested routes such as `/live/<matchId>` and `/umpire/match/<matchId>` are handled by Next.js; no custom rewrite is required.

For this personal deployment, a Vercel personal project is sufficient. Keep the two public Supabase variables in the Vercel project and keep all server secrets in Supabase Edge Function secrets.

## Current limits

- The default roster and draw start in `src/data`. Admins can edit teams, players, fixtures, and courts from the admin panel; those changes sync through Supabase when configured.
- This shared access code is suitable for a small event, not identity-grade authentication. Anyone who knows it can authorize a browser until their session expires.
- Shared passwords identify a browser session rather than a named person. Signed sessions remain valid for up to twelve hours, and no exact active-device limit is enforced.
- Match ownership stays with the umpire session that started it. If that browser session is lost, an admin can override or reset the match.
- Browser-side Realtime uses Supabase's Phoenix WebSocket protocol v2 directly. If Supabase changes that protocol, update the subscription adapter in `src/lib/supabase.ts`.
- Deployment remains a manual operator action. No Supabase project or Vercel deployment is configured by this repository alone.
