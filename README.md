# Video Builder

Turn a topic into a postable short-form video: an LLM writes a scene-by-scene
script, each scene gets matched stock footage, narrated with TTS, captioned,
scored with music/SFX, and rendered to MP4 — all from a topic and a few
clicks.

## Features

- **Script generation** — OpenRouter (any model) writes a scene-by-scene
  breakdown from a topic, validated against a strict schema.
- **Stock footage** — Pexels → Pixabay → generic fallback → animated
  gradient, so a scene never comes back empty.
- **Voiceover** — Azure Speech TTS, per-scene audio with word-level timings
  driving animated captions.
- **Rendering** — Remotion compositions (portrait/square/landscape), three
  templates (energetic/professional/calm), ffmpeg-mixed narration + music +
  SFX.
- **Queue-based pipeline** — every render runs on a BullMQ worker, never
  inline in an HTTP request.
- **Bring your own API keys** — every user can set their own provider keys
  from **Settings → API Keys** instead of the admin having to edit server
  `.env` files. Keys are encrypted at rest (AES-256-GCM) and never shown
  back in plaintext once saved. See [API keys](#api-keys-who-provides-what)
  below.

## Architecture

```
apps/api      Fastify REST API — auth, projects, renders, credentials
apps/worker   BullMQ worker — runs the actual script→footage→voice→
              compose→encode→upload pipeline for each render job
apps/web      Next.js 15 App Router + Tailwind — the product UI
packages/core Shared types, Zod schemas, pipeline logic, DB schema
packages/video Remotion project — compositions, templates, audio mix
```

Data flows: the web app talks to the API over HTTP (session cookie auth);
the API enqueues render jobs onto a Redis/BullMQ queue; the worker consumes
that queue and drives the actual pipeline, writing progress back into
Postgres, which the API streams to the browser over SSE.

## Prerequisites

- **Node.js 20+** and **pnpm** (`corepack enable` will get you the right
  pnpm version automatically).
- **PostgreSQL 14+** and **Redis** — locally via `docker compose up -d`
  (uses the included `docker-compose.yml`), or any native/managed instance.
- **ffmpeg** on the machine that runs `apps/worker` — used for TTS loudness
  normalisation and the final audio mix. Not needed for `apps/api` or
  `apps/web`.
- A Chromium/Chrome binary reachable by `apps/worker` for Remotion's
  rendering step. In most environments Remotion downloads its own managed
  Chrome Headless Shell automatically the first time you render; if your
  environment blocks that download, point `REMOTION_BROWSER_EXECUTABLE` at
  an existing Chrome/Chromium install.

## Quick start

```bash
git clone <this repo> video-builder
cd video-builder
corepack enable
pnpm install

# Start Postgres + Redis locally (skip if you're pointing at managed ones)
pnpm docker:up

# Copy the env template and fill in the bootstrap secrets (see below)
cp .env.example .env

# Apply the database schema
pnpm --filter @video-builder/core db:migrate

# Run each app in its own terminal
pnpm --filter @video-builder/api dev      # http://localhost:4000
pnpm --filter @video-builder/worker dev   # consumes the render queue
pnpm --filter @video-builder/web dev      # http://localhost:3000
```

Open `http://localhost:3000`, sign up (10 free credits), and either use the
admin-configured provider keys (if you set any in `.env`) or add your own
under **Settings → API Keys** — see the next section.

## API keys: who provides what

There are two layers of provider credentials, and you only need one of them
per key:

1. **Server defaults** (`.env` on the machine running `apps/api` /
   `apps/worker`) — `OPENROUTER_API_KEY`, `PEXELS_API_KEY`,
   `PIXABAY_API_KEY`, `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`,
   `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` +
   `R2_BUCKET`. These act as the fallback for any user who hasn't set their
   own key.
2. **Per-user keys** (in-app, no redeploy needed) — every logged-in user can
   open **Settings → API Keys** and paste their own key for any provider.
   A user's own key always wins over the server default. Keys are encrypted
   with AES-256-GCM before they ever touch the database (see
   [Credential encryption](#credential-encryption-credentials_encryption_key)),
   and the API only ever reports *whether* a key is set — the plaintext is
   never sent back to the browser after saving.

Both layers are entirely optional per-provider: leave a server env var
blank and just tell users to set their own; or set server defaults and let
individual users override only the ones they care about. If a provider has
neither a user key nor a server default, that pipeline stage fails with a
clear error (e.g. footage falls back to a gradient; voiceover fails the
render).

Where to get each key:

| Provider | Used for | Get a key |
|---|---|---|
| OpenRouter | Script generation | https://openrouter.ai/keys |
| Pexels | Primary stock footage | https://www.pexels.com/api/ |
| Pixabay | Fallback stock footage | https://pixabay.com/api/docs/ |
| Azure Speech | Voiceover (TTS) | https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices |
| Cloudflare R2 | Stores rendered videos | https://developers.cloudflare.com/r2/get-started/ |

### Credential encryption (`CREDENTIALS_ENCRYPTION_KEY`)

Every per-user secret is encrypted with AES-256-GCM under one master key,
`CREDENTIALS_ENCRYPTION_KEY`, required by both `apps/api` and
`apps/worker` (they must be set to the **exact same value**, or one
process won't be able to decrypt what the other wrote). Generate one with:

```bash
openssl rand -base64 32
```

Treat this like any other production secret: keep it out of git, back it
up somewhere durable (a secrets manager, not a text file next to the repo),
and never rotate it without a migration plan — rotating it makes every
already-stored user key permanently undecryptable, since there is no way
to recover ciphertext without the exact key it was encrypted under.

## Environment variables

Only these are required to boot the app at all — every provider key above
is optional (falls back to per-user keys, or fails that pipeline stage with
a clear error if truly nothing is configured anywhere):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `REDIS_URL` | Yes | Redis connection string (BullMQ) |
| `SESSION_SECRET` | Yes | Lucia session signing; set a real value in production |
| `CREDENTIALS_ENCRYPTION_KEY` | Yes | `openssl rand -base64 32` — see above |
| `WEB_URL` | Yes (default `http://localhost:3000`) | Used for CORS + OAuth redirects |
| `API_URL` | Yes (default `http://localhost:4000`) | Used for the Google OAuth callback URL |
| `API_PORT` | No (default `4000`) | |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Enables "Continue with Google"; omitted = that button 501s |
| `OPENROUTER_MODEL` / `OPENROUTER_MODEL_FALLBACKS` | No | Model choice is server-configured, not per-user |
| `*_API_KEY`, `R2_*`, `AZURE_SPEECH_*` | No | Server-default provider keys, see above |

See `.env.example` for the full template with comments.

## Project structure

```
apps/
  api/      Fastify API (auth, projects, renders, credentials)
  worker/   BullMQ render pipeline worker
  web/      Next.js app
packages/
  core/     Zod schemas, pipeline logic (script/footage/voice), Drizzle
            schema + migrations, encryption, DB client
  video/    Remotion compositions, templates, audio mix, render entrypoint
docs/
  PRD.md            Product spec / source of truth for product decisions
  build-prompts.md  The original phased build pack this was built from
```

Each pipeline stage in `packages/core` also ships a standalone CLI so you
can exercise it without the full app:

```bash
pnpm script:gen -- --topic "5 benefits of green tea"
pnpm footage:test -- --script ./out/script.json
pnpm voice:test -- --script ./out/script.json
pnpm video:render -- --input ./out/pipeline.json
pnpm video:studio   # Remotion Studio, for previewing compositions visually
```

## SFX and music assets

Rendered videos mix in template-driven SFX and a mood-matched music bed.
The actual audio files aren't included in this repo (licensing) — drop your
own into `packages/video/assets/sfx/` and `packages/video/assets/music/`
following the filenames listed in `packages/video/src/templates/index.ts`
and the READMEs in those two directories. A render works fine without
them (narration-only), so this is optional to get started.

## Testing

```bash
pnpm test          # vitest across every workspace
pnpm typecheck      # tsc --noEmit across every workspace
pnpm lint           # eslint across the repo
```

Most tests mock external providers (OpenRouter, Pexels, Azure) so they run
with no API keys configured. A handful of integration tests (Drizzle
upserts, the worker's DB orchestration, credential encryption round-trips)
run against a real Postgres and are automatically **skipped** — not
failed — when `DATABASE_URL` isn't reachable, so `pnpm test` still passes
in an environment with no database running.

## Deployment notes

- `apps/api` and `apps/web` are stateless and horizontally scalable;
  `apps/worker` should run wherever ffmpeg + a Chrome/Chromium binary are
  available (rendering is CPU-heavy — size accordingly).
- Set `NODE_ENV=production` so session cookies get `secure: true` (requires
  serving over HTTPS).
- `CREDENTIALS_ENCRYPTION_KEY` and `SESSION_SECRET` must be real, unique
  values in production — never the dev defaults.
- Rendered outputs are stored in Cloudflare R2 (or any S3-compatible
  bucket) and only ever served through short-lived signed URLs, never a
  public path.

## Credits

New accounts start with 10 credits. A credit is charged only when a render
**succeeds** — never on enqueue, and never for a failed render (the worker
retries once, then marks the render failed with nothing charged).
