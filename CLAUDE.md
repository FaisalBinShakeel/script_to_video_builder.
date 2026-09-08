# CLAUDE.md

This file guides Claude Code (and any contributor) working in this repo.

## Source of truth

`docs/PRD.md` is the source of truth for product decisions (data model, API
surface, screens, scope). `docs/build-prompts.md` is the original phased
build pack this project was scaffolded from — Prompt 4 in particular is
normative for the Remotion/audio-mix implementation in `packages/video`.
When in doubt, `docs/PRD.md` wins.

## Stack

- TypeScript everywhere, pnpm workspaces monorepo.
- `apps/api` — Fastify REST API.
- `apps/worker` — BullMQ worker that runs the render pipeline.
- `apps/web` — Next.js 15 App Router + Tailwind.
- `packages/core` — shared types, Zod schemas, pipeline logic.
- `packages/video` — Remotion project (compositions).
- PostgreSQL via Drizzle ORM, Redis via BullMQ.

## Non-negotiable rules

- Audio duration is authoritative. TTS output length determines scene length.
  Visuals stretch to fit audio. Never trim audio to fit a planned duration.
- Generate narration audio per scene, never as one long file. Partial
  re-renders depend on this.
- Every OpenRouter call must set `provider.require_parameters = true`.
  Without it, OpenRouter silently routes to providers that don't support
  `json_schema` and returns malformed JSON.
- Always validate LLM output with Zod at the API boundary, even with
  structured outputs enabled. Structured output is a strong prior, not a
  guarantee.
- Never serve raw music or SFX files to users. Audio may only leave the
  system baked into a rendered MP4. This is a licensing requirement.
- Rendering never happens inside an HTTP request. Always via the queue.
- No secrets in client code. All provider keys are server-side only.
- Provider API keys can come from two places: the server's own env vars
  (admin default) or a user's own key set via Settings > API Keys. A
  user's key is always stored encrypted (AES-256-GCM under
  CREDENTIALS_ENCRYPTION_KEY, see packages/core/src/crypto/secret-box.ts)
  and never returned to the client in plaintext once saved -- API
  responses only ever say whether a key is set. Resolve credentials with
  `resolveUserCredentials()`, never by reading `process.env.*_API_KEY`
  directly in a request/job handler.

## Commands

```bash
pnpm install                  # install all workspaces
pnpm docker:up                # start local Postgres + Redis (docker compose up -d)
pnpm build                    # build all packages
pnpm lint                     # eslint across the repo
pnpm format                   # prettier --write
pnpm typecheck                # tsc --noEmit across workspaces
pnpm test                     # vitest across workspaces

pnpm script:gen -- --topic "5 benefits of green tea"   # phase 1 CLI
pnpm footage:test -- --script ./out/script.json        # phase 2 CLI
pnpm voice:test -- --script ./out/script.json           # phase 3 CLI
pnpm video:render -- --input ./out/pipeline.json        # phase 4 CLI
pnpm video:studio                                        # Remotion Studio
```

## Working conventions

- Build in phases (see `docs/build-prompts.md`). Finish what a phase
  specifies, then stop — don't add features from a later phase early.
- Every phase that touches `packages/core` ships a CLI entry point and
  Vitest tests with mocked external providers, so behavior is verifiable
  without live API keys.
