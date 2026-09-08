# Claude Code Build Pack — AI Video Generation Platform

## How to use this

**Don't paste the whole thing at once.** The full PRD is a multi-month scope; handing it to Claude Code in one message produces a shallow, half-broken scaffold of everything and a working version of nothing.

The correct workflow:

1. Create an empty repo and open Claude Code in it
2. Copy `ai-video-saas-prd.md` into the repo root as `docs/PRD.md`
3. Paste **Prompt 0** to set up the project and `CLAUDE.md`
4. Then paste **Prompt 1**. Get it working. Commit.
5. Then Prompt 2. And so on.

Each phase ends with an acceptance criterion you can verify yourself. Do not move to the next phase until the current one passes. If a phase drifts, `/clear` the context and start the next phase fresh — the PRD and `CLAUDE.md` carry the context forward, not the chat history.

---

## Prompt 0 — Project setup

```
I'm building an AI video generation SaaS. The full product spec is in docs/PRD.md — read it first.

We are building this in phases. This message is phase 0: setup only. Do NOT
build features yet.

Stack (already decided, don't propose alternatives):
- TypeScript everywhere, pnpm workspaces monorepo
- apps/api      — Fastify REST API
- apps/worker   — BullMQ worker that runs the render pipeline
- apps/web      — Next.js 15 App Router + Tailwind
- packages/core — shared types, Zod schemas, pipeline logic
- packages/video — Remotion project (compositions)
- PostgreSQL via Drizzle ORM, Redis via BullMQ

Tasks for this phase:
1. Read docs/PRD.md fully.
2. Scaffold the monorepo with the workspace layout above. Strict TypeScript.
   Shared tsconfig base. ESLint + Prettier.
3. Create .env.example with every variable the PRD implies:
   OPENROUTER_API_KEY, PEXELS_API_KEY, PIXABAY_API_KEY,
   AZURE_SPEECH_KEY, AZURE_SPEECH_REGION,
   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
   DATABASE_URL, REDIS_URL
4. docker-compose.yml for local Postgres + Redis only.
5. Write CLAUDE.md at the repo root containing: the stack above, the
   non-negotiable rules listed below, the pnpm commands, and a note that
   docs/PRD.md is the source of truth for product decisions.

Non-negotiable rules to put in CLAUDE.md verbatim:
- Audio duration is authoritative. TTS output length determines scene length.
  Visuals stretch to fit audio. Never trim audio to fit a planned duration.
- Generate narration audio per scene, never as one long file. Partial
  re-renders depend on this.
- Every OpenRouter call must set provider.require_parameters = true.
  Without it, OpenRouter silently routes to providers that don't support
  json_schema and returns malformed JSON.
- Always validate LLM output with Zod at the API boundary, even with
  structured outputs enabled. Structured output is a strong prior, not a
  guarantee.
- Never serve raw music or SFX files to users. Audio may only leave the
  system baked into a rendered MP4. This is a licensing requirement.
- Rendering never happens inside an HTTP request. Always via the queue.
- No secrets in client code. All provider keys are server-side only.

Do not install Remotion or write any pipeline code yet. Stop after setup and
show me the tree.
```

---

## Prompt 1 — Script generation (the core)

This is the most important phase. Everything downstream consumes its output.

```
Phase 1: script generation. Build this in packages/core only. No API routes,
no UI, no video yet.

Goal: a function that takes a topic and returns a validated scene breakdown.

1. Define the Zod schema in packages/core/src/schema/script.ts:

   VideoScript {
     title: string
     language: 'en' | 'ur'
     tone: 'energetic' | 'professional' | 'calm' | 'story'
     musicMood: 'upbeat' | 'ambient' | 'cinematic' | 'corporate'
     scenes: Scene[]           // 3 to 12
     estimatedDuration: number
   }

   Scene {
     id: number
     narration: string          // what the voice says
     onScreenText: string       // max 8 words, shown on screen
     searchKeywords: string[]   // 2-3 variants, for stock footage search
     duration: number           // estimate only, TTS will override
     emphasis: 'hook' | 'normal' | 'cta'
   }

   Export the JSON Schema derived from the Zod schema (use zod-to-json-schema)
   so the same definition drives both the LLM request and validation.

2. OpenRouter client in packages/core/src/llm/openrouter.ts:
   - Use the OpenAI SDK with baseURL https://openrouter.ai/api/v1
   - Model configurable via env, with a fallback array
   - MUST send: provider: { require_parameters: true }
   - MUST send: response_format with type json_schema, strict: true
   - Log the `provider` field from every response so routing changes are
     traceable
   - Retry once on schema validation failure with the validation error fed
     back into the prompt. Fail loudly on the second attempt.

3. generateScript(input) in packages/core/src/pipeline/script.ts:
   input: { topic, tone, language, targetDuration, format }
   - Scene count derived from duration: 15s→4, 30s→6, 45s→8, 60s→10
   - Narration word budget ≈ 2.5 words/second of target duration
   - Scene 1 must be a hook
   - Last scene must have emphasis 'cta'
   - searchKeywords must be visually concrete nouns/actions, not abstract
     concepts. "person typing laptop" not "productivity". Put this in the
     prompt with examples — it's the main lever on final video quality.

4. A CLI script: pnpm script:gen -- --topic "5 benefits of green tea"
   that prints the validated JSON.

5. Vitest tests with a mocked OpenRouter response covering: valid parse,
   malformed JSON, schema violation triggering retry, retry exhaustion.

Acceptance: I run the CLI with three different topics and get valid,
sensible scene breakdowns where the keywords would plausibly return good
stock footage.
```

---

## Prompt 2 — Stock footage

```
Phase 2: stock footage sourcing. packages/core only, still no rendering.

Build packages/core/src/pipeline/footage.ts:

1. Pexels Videos API client. Search by keyword, filter by:
   - orientation matching target format (portrait/square/landscape)
   - minimum 1080p
   - duration >= scene duration where possible

2. Fallback chain, in order, until a clip is found:
   a. Pexels with keyword variant 1, then 2, then 3
   b. Pixabay with the same variants
   c. Pexels with a generic keyword derived from the video title
   d. A generated gradient background (return a marker, not a clip)
   Log which fallback level was hit — this is our quality metric.

3. Deduplication: never return the same asset twice within one video.

4. Asset cache: before downloading, check a local cache keyed by
   provider + providerAssetId. Store downloads in a cache dir. Structure the
   interface so the storage backend can be swapped to R2 later without
   changing callers.

5. selectFootage(script) → returns a clip (or gradient marker) per scene,
   plus attribution metadata per asset.

6. CLI: pnpm footage:test -- --script ./out/script.json
   Prints the chosen clip URL and fallback level per scene.

Tests: mock both APIs. Cover empty results, all-variants-fail, dedup, and
cache hit.

Acceptance: I run it on a real generated script and the fallback level is
'a' for most scenes.
```

---

## Prompt 3 — Voiceover and timings

```
Phase 3: TTS. packages/core only.

Build packages/core/src/pipeline/voice.ts:

1. Azure Speech TTS client. Per-scene synthesis, never one combined file.
   Output 48kHz mono WAV to a working directory.

2. Capture word-level boundary events from the Azure SDK and return them
   alongside the audio:
   { sceneId, audioPath, durationMs, words: [{ text, startMs, endMs }] }
   These timings drive caption animation later — they are as important as
   the audio itself.

3. Loudness-normalise each scene's audio to -16 LUFS via ffmpeg. TTS output
   volume varies between voices and unnormalised audio makes some videos
   noticeably quieter than others.

4. Update the script object: replace each scene's estimated duration with
   the ACTUAL audio duration. This is now the authoritative timeline.
   Recompute estimatedDuration as the sum.

5. Provider interface (TTSProvider) so ElevenLabs can be added later as a
   premium path without touching callers.

6. CLI: pnpm voice:test -- --script ./out/script.json

Tests: mock the Azure SDK. Cover timing extraction, duration override, and
the normalisation call being issued.

Acceptance: per-scene WAVs exist, word timings look correct against the
audio, and the script's durations have been replaced with real ones.
```

---

## Prompt 4 — Remotion composition and audio mix

The hardest phase. Give it room and expect iteration.

```
Phase 4: video composition. Work in packages/video.

Set up Remotion. Note: Remotion is free for teams of 1-3 people including
commercial use, so no licence config is needed — do not add licence checks.

1. Composition `SocialVideo` taking props: script (with real durations),
   footage per scene, audio per scene with word timings, template name,
   format.

2. Formats: 1080x1920, 1080x1080, 1920x1080. Same composition, different
   dimensions.

3. Per scene:
   - Background: the stock clip, object-fit cover, trimmed to scene duration.
     If the clip is shorter than the scene, loop it. If it's a gradient
     marker, render an animated gradient instead.
   - Subtle Ken Burns push on the clip (scale 1.0 → 1.05) so static-feeling
     footage reads as intentional.
   - onScreenText, animated per the template.
   - Word-synced captions from the word timings.

4. Captions:
   - Safe zone: keep out of the bottom 15% and top 10% on vertical.
   - Three styles: classic bar, word-pop highlight, karaoke fill.
   - Drive them from word timings, not from estimated character counts.

5. Templates. A template is a config object, not a separate component tree:
   { transition, textAnimation, captionStyle, sfxMap }
   Build three: energetic, professional, calm.

6. Audio mix, done in ffmpeg as a post-render step, not inside Remotion:
   - narration at 0 dB (already normalised in phase 3)
   - music sidechain-ducked to -18 dB under narration, -8 dB elsewhere
   - SFX at -12 dB
   - final limiter with a -1 dBTP ceiling
   - output AAC 128kbps

7. SFX are template-driven, NOT chosen by the LLM. The template's sfxMap
   defines which sound fires on which event:
   scene transition → whoosh, text appears → pop, hook → impact,
   final scene → resolve hit. Rotate variants so repeats aren't obvious.
   Read files from assets/sfx/ — I'll supply the actual audio files.

8. Render entrypoint: renderVideo(props) → mp4 path. H.264, 30fps.
   Watermark overlay when props.watermark is true.

9. Remotion Studio must work for previewing with a fixture props file.

Acceptance: `pnpm video:render -- --input ./out/pipeline.json` produces an
MP4 I would actually consider posting. Captions land on the words. Music
sits under the voice without fighting it.
```

---

## Prompt 5 — Queue, API, persistence

```
Phase 5: wire the pipeline into a service.

1. Drizzle schema and migrations for the tables in PRD section 6.3:
   users, brand_kits, projects, renders, scene_assets, asset_cache,
   music_tracks, usage_events.

2. apps/worker: BullMQ worker running the full pipeline —
   script → footage → voice → compose → encode → upload.
   - Report progress after each stage (stage name + percent) to the job.
   - Retry once on failure. On second failure, refund the credit and mark
     the render failed with a user-readable message.
   - Log per-stage duration and estimated cost into the renders row.

3. R2 upload via the S3 SDK. Serve outputs through signed URLs only.

4. apps/api endpoints from PRD 6.4. Auth with Lucia, sessions in cookies.
   - Credits deducted on SUCCESS only, never on enqueue.
   - Per-user concurrency cap of 2 running renders.
   - SSE endpoint streaming render progress.

5. Migrate the asset cache to R2 behind the interface from phase 2.

Acceptance: POST a topic to the API, watch the SSE stream through every
stage, and receive a signed URL to a finished MP4.
```

---

## Prompt 6 — Web UI

```
Phase 6: apps/web. Next.js App Router, Tailwind, server components where
sensible.

Screens:
1. Auth (email/password + Google)
2. Dashboard: project list, credits remaining, "New Video"
3. Create flow:
   - Step 1: topic textarea
   - Step 2: format / length / tone / language / voice, with voice preview
   - Step 3: generated scenes as editable cards (narration, on-screen text,
     keywords, and a clip thumbnail per scene)
   - Step 4: progress screen driven by the SSE stream, showing the real
     stage names
   - Step 5: preview player, download, edit, regenerate
4. Settings: brand kit

Design direction: this is a creator tool, so it should feel closer to a
video editor than to a dashboard. Dark surface, one strong accent colour,
generous spacing, real typographic hierarchy. Do not produce the default
Tailwind admin-panel look — no card grids with grey borders everywhere.

Mobile must work properly down to 380px. Many users will create on a phone.

Acceptance: I sign up on my phone and export a video without touching a
desktop.
```

---

## Guardrails to repeat when Claude Code drifts

Paste these as corrections when needed:

> Stop adding features that aren't in the current phase. Finish what's specified, then stop.

> You're trimming audio to fit a planned duration. Reverse it — audio duration is authoritative, the visual adapts.

> That OpenRouter call is missing `provider: { require_parameters: true }`. Add it to every call.

> Don't skip Zod validation because structured outputs are enabled. Validate anyway.

> You're generating one narration file for the whole video. Generate per-scene audio — partial re-render depends on it.

> That endpoint runs a render inline. Enqueue it instead.

> Don't expose that audio file over a URL. Music and SFX may only leave the system baked into an MP4.

---

## Suggested commit checkpoints

| After | Commit message |
|---|---|
| Prompt 0 | `chore: monorepo scaffold and project rules` |
| Prompt 1 | `feat: script generation via OpenRouter with schema validation` |
| Prompt 2 | `feat: stock footage sourcing with fallback chain` |
| Prompt 3 | `feat: azure tts with word timings and loudness normalisation` |
| Prompt 4 | `feat: remotion compositions, templates and audio mix` |
| Prompt 5 | `feat: render queue, api and persistence` |
| Prompt 6 | `feat: web application` |

---

## One piece of advice on sequencing

Phase 4 is where this project succeeds or fails, and it's also the phase most likely to eat a week. Before you start it, do the M0 spike from the PRD by hand: write one scene JSON yourself, grab one stock clip, generate one voiceover, and assemble it manually with ffmpeg. Twenty minutes of manual work will tell you more about whether the output quality is acceptable than three days of building the automation around it.

If the hand-assembled version doesn't look good, the automated version won't either.
