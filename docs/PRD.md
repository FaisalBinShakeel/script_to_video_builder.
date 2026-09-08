# AI Video Generation SaaS — Product Requirements Document

## 1. Product Summary

A SaaS tool that turns a topic or script idea into a short, vertical/square/landscape
social video: an LLM writes a scene-by-scene script, each scene is matched with
stock footage, narrated with TTS, captioned, scored with music/SFX per a chosen
template, and rendered to MP4. Target users are solo creators, social media
managers, and small marketing teams who want to go from an idea to a postable
video in minutes without a video editor.

## 2. Core User Journey

1. User enters a topic (or pastes a script) and picks format/length/tone/language/voice.
2. System generates a scene breakdown (script) via LLM.
3. User reviews/edits scenes (narration, on-screen text, keywords) as cards.
4. System sources stock footage per scene, generates per-scene narration audio
   with word-level timings, composes captions/text/Ken-Burns/transitions per a
   template, mixes music + SFX under the narration, and renders an MP4.
5. User previews, downloads, or regenerates individual scenes.

## 3. Non-Negotiable Engineering Rules

- Audio duration is authoritative. TTS output length determines scene length.
  Visuals stretch to fit audio. Never trim audio to fit a planned duration.
- Generate narration audio per scene, never as one long file. Partial
  re-renders depend on this.
- Every OpenRouter call must set `provider.require_parameters = true`. Without
  it, OpenRouter silently routes to providers that don't support `json_schema`
  and returns malformed JSON.
- Always validate LLM output with Zod at the API boundary, even with
  structured outputs enabled. Structured output is a strong prior, not a
  guarantee.
- Never serve raw music or SFX files to users. Audio may only leave the
  system baked into a rendered MP4. This is a licensing requirement.
- Rendering never happens inside an HTTP request. Always via the queue.
- No secrets in client code. All provider keys are server-side only.

## 4. Stack

- TypeScript everywhere, pnpm workspaces monorepo.
- `apps/api` — Fastify REST API.
- `apps/worker` — BullMQ worker that runs the render pipeline.
- `apps/web` — Next.js 15 App Router + Tailwind.
- `packages/core` — shared types, Zod schemas, pipeline logic (script,
  footage, voice).
- `packages/video` — Remotion project (compositions, templates, rendering,
  audio mix).
- PostgreSQL via Drizzle ORM, Redis via BullMQ, Cloudflare R2 for asset/output
  storage.

## 5. Video Formats

- Portrait `1080x1920` (default, e.g. Reels/TikTok/Shorts)
- Square `1080x1080`
- Landscape `1920x1080`

Lengths map to scene counts: 15s→4 scenes, 30s→6, 45s→8, 60s→10.

## 6. Data Model

### 6.1 Script domain types

See `packages/core/src/schema/script.ts` — `VideoScript` and `Scene` Zod
schemas are the canonical definition; this document does not duplicate field
lists that would drift from the code.

### 6.2 Pipeline stages

`script` → `footage` → `voice` → `compose` → `encode` → `upload`. The worker
reports `{ stage, percent }` after each stage completes.

### 6.3 Database tables (Drizzle / Postgres)

- **users** — id, email, password_hash (nullable for OAuth), google_id
  (nullable), name, credits, created_at.
- **brand_kits** — id, user_id, name, primary_color, accent_color, font,
  logo_url, watermark_enabled, created_at.
- **projects** — id, user_id, brand_kit_id (nullable), title, topic, format,
  language, tone, music_mood, status, script_json, created_at, updated_at.
- **renders** — id, project_id, user_id, status
  (`queued|running|succeeded|failed`), stage, percent, output_url,
  error_message, cost_cents, duration_ms, credits_charged, created_at,
  started_at, finished_at.
- **scene_assets** — id, render_id, scene_id (int, scene index within the
  script), footage_provider, footage_asset_id, footage_url, fallback_level
  (`a|b|c|d`), audio_path, duration_ms, created_at.
- **asset_cache** — id, provider, provider_asset_id, storage_key, local_path
  (nullable), width, height, duration_ms, created_at. Unique on
  `(provider, provider_asset_id)`.
- **music_tracks** — id, mood, title, storage_key, duration_ms, license,
  created_at.
- **usage_events** — id, user_id, type (`render_started|render_succeeded|
  render_failed|credit_purchase|credit_refund`), credits_delta, render_id
  (nullable), metadata_json, created_at.

### 6.4 API endpoints (`apps/api`)

Auth (Lucia, session cookie):
- `POST /auth/signup` — email + password.
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/google` / `GET /auth/google/callback`
- `GET /auth/me`

Projects & rendering:
- `POST /projects` — `{ topic, format, targetDuration, tone, language,
  musicMood, voiceId }` → generates the script (Phase 1 pipeline), creates a
  project row, returns the project with its script for review.
- `PATCH /projects/:id/script` — user-edited scenes.
- `POST /projects/:id/render` — enqueues a render job (BullMQ). Rejects with
  429 if the user already has 2 renders running. Does not deduct credits yet.
- `GET /projects/:id`
- `GET /projects` — list, paginated.
- `GET /renders/:id` — current status snapshot.
- `GET /renders/:id/stream` — Server-Sent Events, streams `{ stage, percent }`
  until `succeeded`/`failed`, then a final event with the signed output URL.
- `GET /renders/:id/download` — 302 to a freshly signed R2 URL (short TTL),
  never a public/raw URL.

Brand kit & account:
- `GET /brand-kit` / `PUT /brand-kit`
- `GET /account/credits`

Credits are deducted only when a render's status transitions to `succeeded`
(worker writes this transactionally with the renders row). A failed render
after the retry is exhausted issues a `usage_events` refund entry and never
charged in the first place, so "refund" here means: release any credit hold
and mark the render failed with a user-readable `error_message`.

## 7. Rendering Pipeline Detail

See Prompt 4 in `docs/build-prompts.md` for the full Remotion/audio-mix spec
(templates, caption styles, SFX map, ffmpeg mix chain). That spec is
normative for `packages/video`.

## 8. Screens (`apps/web`)

1. Auth (email/password + Google).
2. Dashboard: project list, credits remaining, "New Video" CTA.
3. Create flow: topic → format/length/tone/language/voice → scene review
   cards → SSE-driven progress → preview/download/edit/regenerate.
4. Settings: brand kit (colors, font, logo, watermark toggle).

Design direction: creator tool, not an admin dashboard — dark surface, one
accent color, real typographic hierarchy, no grey-bordered card grids.
Mobile must work down to 380px width.

## 9. Out of Scope (v1)

- Multi-user team accounts / collaboration.
- ElevenLabs premium voice path (interface only, no implementation).
- Automatic music track selection by the LLM (SFX and music are
  template/mood driven, never LLM-chosen, per the non-negotiable rules).
- Payment processing implementation (credits exist as a column/ledger only;
  no Stripe integration in this phase).
