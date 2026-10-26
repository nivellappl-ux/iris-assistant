# IRIS

Um assistente conversacional para desktop, inspirado na Dynamic Island e acompanhado pela mascote Mochi.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env for the API server: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/coucou-assistant/` — previewable IRIS companion
- `artifacts/api-server/` — shared API service
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- The web artifact is a preview of a desktop companion; Windows/macOS monitoring is not connected yet.
- Conversation and preferences persist in browser local storage. Existing task, inbox, project, and focus records remain under their current storage keys, but the app no longer exposes or updates them; do not clear or migrate them.
- The AI provider defaults to Gemini through Replit AI Integrations (`AI_PROVIDER=gemini`) using `gemini-3.8-flash`; Replit bills the model usage to Replit credits. `AI_PROVIDER=openai` explicitly selects the existing OpenAI provider, whose implementation and configuration must remain unchanged. Gemini is not connected to Duvion and cannot access local records.
- The Mochi Canvas engine and sounds are reused from the supplied Coucou source. The user states they have the original author's permission for the name and artwork; retain the included notices.

## Product

- IRIS supports conversation by text and voice, settings, help, Mochi, and the Dynamic Island.
- Task, inbox/capture, project, and focus screens and actions have been removed from the app; the user's existing local records are preserved.
- The UI and assistant guidance should remain in Portuguese.

## User preferences

- Após cada alteração feita nesta aplicação, sincronizar o commit com o repositório GitHub. Se o envio não estiver disponível, informar o bloqueio.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
