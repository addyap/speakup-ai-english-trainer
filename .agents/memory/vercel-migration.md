---
name: Vercel migration architecture
description: How the app is structured to run on both Replit (Express) and Vercel (serverless functions)
---

## Architecture

`/api/trainer/_shared.ts` is the ONE implementation of every route handler.
- Vercel functions (`/api/trainer/*.ts`) call these handlers directly via default export.
- Express thin wrapper (`artifacts/api-server/src/routes/trainer.ts`) wraps them with `RequestHandler` cast.

## OpenAI client (`api/_lib/openai.ts`)
Prefers `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL` (Replit integration),
falls back to `OPENAI_API_KEY` (standard). Same file works in both environments.

**Why:** One client, two env var sets — Replit keeps working without any env var changes.

## Database (`api/_lib/db.ts`)
Returns `null` when `DATABASE_URL` is absent. Session logging is fire-and-forget, callers check for null.
On Vercel: users must supply a publicly accessible PostgreSQL URL (Neon/Supabase).

## TypeScript
`artifacts/api-server/tsconfig.json` has `rootDir` removed and `"include": ["src", "../../api"]`
so the Express wrapper can import from `../../api/` without TS errors.
`openai`, `zod`, `pg`, `@vercel/node`, `@types/pg` are installed at the workspace root
so the `/api/` functions can resolve them (not a workspace package itself).

## Vite config change
`artifacts/english-trainer/vite.config.ts` — `PORT` and `BASE_PATH` are now optional with defaults
(`3000` and `"/"` respectively) so `vite build` runs on Vercel without those env vars set.

## vercel.json
- buildCommand: `pnpm run typecheck:libs && pnpm --filter @workspace/english-trainer run build`
- outputDirectory: `artifacts/english-trainer/dist/public`
- env: `BASE_PATH: "/"` injected at build time
- `maxDuration: 30` on all functions (covers SSE streaming)

## What needs manual Vercel setup
1. `OPENAI_API_KEY` — Project Settings → Environment Variables
2. `DATABASE_URL` — pointing to Neon/Supabase (optional; session logging gracefully absent)
3. Clerk: create a Clerk app at clerk.com, add Vercel domain, set `CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`
4. Install Vercel CLI / connect GitHub repo, set root directory to `.` (monorepo root)
