import { z } from "zod";
// Import the schema submodule directly (not the package barrel) so this
// file -- which SocialVideo.tsx pulls in via Root.tsx -- never drags
// Node-only pipeline code (fs, child_process) into the browser-side
// Remotion bundle.
import { SceneSchema } from "@video-builder/core/schema/script.js";

export type Format = "portrait" | "square" | "landscape";
export type TemplateName = "energetic" | "professional" | "calm";

export const FORMAT_DIMENSIONS: Record<Format, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1920, height: 1080 },
};

export const FPS = 30;

const CaptionWordSchema = z.object({
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
});
export type CaptionWord = z.infer<typeof CaptionWordSchema>;

const SceneFootageSchema = z.union([
  z.object({
    kind: z.literal("clip"),
    provider: z.enum(["pexels", "pixabay"]),
    providerAssetId: z.string(),
    fileUrl: z.string(),
    width: z.number(),
    height: z.number(),
    durationSec: z.number(),
    attribution: z.object({
      provider: z.enum(["pexels", "pixabay"]),
      photographer: z.string().optional(),
      photographerUrl: z.string().optional(),
      sourceUrl: z.string(),
    }),
  }),
  z.object({
    kind: z.literal("gradient"),
    seed: z.string(),
  }),
]);

const RenderSceneInputSchema = z.object({
  scene: SceneSchema,
  footage: SceneFootageSchema,
  audio: z.object({
    /** Path to the normalised, scene-relative narration WAV. Not read by
     * Remotion (audio is muxed in the ffmpeg post-render step) but carried
     * through so the audio-mix step knows where each scene's file lives. */
    audioPath: z.string(),
    durationMs: z.number().positive(),
    words: z.array(CaptionWordSchema),
  }),
});
export type RenderSceneInput = z.infer<typeof RenderSceneInputSchema>;

/**
 * Validated at the render CLI/worker boundary -- this is the JSON contract
 * between the pipeline (script + footage + voice) and packages/video.
 */
export const RenderVideoPropsSchema = z.object({
  title: z.string(),
  scenes: z.array(RenderSceneInputSchema).min(1),
  template: z.enum(["energetic", "professional", "calm"]),
  format: z.enum(["portrait", "square", "landscape"]),
  musicMood: z.enum(["upbeat", "ambient", "cinematic", "corporate"]),
  watermark: z.boolean(),
});
export type RenderVideoProps = z.infer<typeof RenderVideoPropsSchema>;

/** A scene's absolute start offset (ms) within the final timeline, derived
 * by summing prior scenes' real (audio-driven) durations. */
export function sceneStartOffsetsMs(scenes: RenderSceneInput[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const s of scenes) {
    offsets.push(cursor);
    cursor += s.audio.durationMs;
  }
  return offsets;
}

export function totalDurationMs(scenes: RenderSceneInput[]): number {
  return scenes.reduce((sum, s) => sum + s.audio.durationMs, 0);
}

export function msToFrames(ms: number, fps: number = FPS): number {
  return Math.round((ms / 1000) * fps);
}
