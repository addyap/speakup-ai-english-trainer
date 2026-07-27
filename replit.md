# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### AI English Speaking Trainer (`artifacts/english-trainer`)
- React + Vite + TypeScript + Tailwind v4
- Clerk authentication (dev keys)
- 12 interface languages with full i18n support (`src/i18n/translations.ts`)
- Views: Home → Language → Setup → Conversation → Feedback
- Features:
  - Voice input (Web Speech API) + text input
  - Text-to-speech (Web Speech Synthesis) with accent/speed settings
  - Help me answer (AI hint suggestions)
  - Improve my sentence (AI grammar/fluency rewrite)
  - Translate AI messages to native language
  - Session feedback with CEFR level estimate
  - Learner memory across sessions (localStorage, `src/lib/learnerMemory.ts`)
  - 30 conversation scenarios, 3 coaching modes, 4 difficulty levels
  - Session progress bar (15 turns max)

### API Server (`artifacts/api-server`)
- Express 5 + TypeScript
- OpenAI integration (gpt-5.2) via Replit AI integration proxy
- Routes: `/api/trainer/conversation`, `/feedback`, `/hint`, `/improve`, `/translate`
- PostgreSQL session logging (anonymous device ID)
- Professional AI personas per scenario
- Learner context injection from cross-session memory

### Shared Libraries
- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 contract
- `lib/api-client-react` — Orval-generated React Query hooks + Zod schemas
- `lib/api-zod` — Zod validation schemas for server-side use
- `lib/db` — PostgreSQL connection pool
- `lib/integrations-openai-ai-server` — OpenAI client via Replit integration
