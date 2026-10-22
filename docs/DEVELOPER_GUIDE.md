# LM-Badminton Developer Guide

## Stack and structure

- Next.js App Router, React, TypeScript, and Tailwind CSS.
- Initial roster and bracket: `src/data`.
- Match rules and progression: `src/reducers` and `src/lib`.
- Supabase schema: `supabase/migrations`.
- Protected API: `supabase/functions/umpire`.

## Supabase usage

Supabase stores only mutable shared state:

- `match_states`: scores, games, service, status, history, and bracket advancement.
- `tournament_config`: admin-edited tournament, teams, players, courts, and byes.
- `umpire_attempt_windows`: password attempt rate limiting.

Public clients have read-only RLS access. All writes pass through the `umpire` Edge Function, which verifies stateless signed sessions, roles, and record revisions. Every umpire session can manage any match; the legacy `match_leases` table is unused. Supabase Realtime sends score and configuration updates to connected browsers. Sounds, animations, toast history, notification preferences, and umpire mute preferences stay in the browser. Global sound and animation switches use the existing `tournament_config` JSON record.

## Run locally

Requires Node.js 22+.

```bash
npm install
cp .env.example .env.local
# Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Use a separate Supabase project for isolated development. To configure one:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy umpire
```

Generate password hashes with `node scripts/hash-umpire-code.mjs` and store the resulting hashes, peppers, and `UMPIRE_SESSION_SECRET` as Supabase Edge Function secrets.

## Deployment

Import the Git repository into a personal Vercel project and set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Push to the production branch to deploy. Database migrations and Edge Functions are deployed separately with the Supabase CLI.

Never commit `.env.local`, database passwords, service-role keys, session secrets, peppers, hashes, or plaintext access passwords. Only the Supabase URL and anon key belong in Vercel.

Before release, run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```
