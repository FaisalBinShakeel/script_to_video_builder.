import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const LANGUAGES = ["en", "ur"] as const;
export const TONES = ["energetic", "professional", "calm", "story"] as const;
export const MUSIC_MOODS = [
  "upbeat",
  "ambient",
  "cinematic",
  "corporate",
] as const;
export const EMPHASES = ["hook", "normal", "cta"] as const;
export const FORMATS = ["portrait", "square", "landscape"] as const;

export const SceneSchema = z.object({
  id: z.number().int().min(1),
  narration: z
    .string()
    .min(1)
    .describe("What the voice says for this scene."),
  onScreenText: z
    .string()
    .min(1)
    .describe(
      "Short text overlay for this scene, at most 8 words, punchy and concrete.",
    ),
  searchKeywords: z
    .array(z.string().min(1))
    .min(2)
    .max(3)
    .describe(
      "2-3 visually concrete stock-footage search variants for this scene, " +
        "e.g. 'person typing laptop' not 'productivity'.",
    ),
  duration: z
    .number()
    .positive()
    .describe(
      "Estimated scene duration in seconds. TTS output will override this.",
    ),
  emphasis: z.enum(EMPHASES),
});
export type Scene = z.infer<typeof SceneSchema>;

export const VideoScriptSchema = z.object({
  title: z.string().min(1),
  language: z.enum(LANGUAGES),
  tone: z.enum(TONES),
  musicMood: z.enum(MUSIC_MOODS),
  scenes: z.array(SceneSchema).min(3).max(12),
  estimatedDuration: z
    .number()
    .positive()
    .describe("Sum of scene durations, in seconds."),
});
export type VideoScript = z.infer<typeof VideoScriptSchema>;

/**
 * JSON Schema derived from VideoScriptSchema, used to drive the LLM's
 * structured-output request. Keeping this derived (rather than hand-written)
 * means the request schema and the Zod validator can never drift apart.
 */
export const VIDEO_SCRIPT_JSON_SCHEMA = zodToJsonSchema(VideoScriptSchema, {
  name: "VideoScript",
  target: "openApi3",
});

export const ScriptGenerationInputSchema = z.object({
  topic: z.string().min(1),
  tone: z.enum(TONES),
  language: z.enum(LANGUAGES),
  targetDuration: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
  ]),
  format: z.enum(FORMATS),
});
export type ScriptGenerationInput = z.infer<typeof ScriptGenerationInputSchema>;

/** Scene count derived from target duration, per the PRD. */
export const SCENE_COUNT_BY_DURATION: Record<
  ScriptGenerationInput["targetDuration"],
  number
> = {
  15: 4,
  30: 6,
  45: 8,
  60: 10,
};

/** Narration word budget: ~2.5 words per second of target duration. */
export const WORDS_PER_SECOND = 2.5;
