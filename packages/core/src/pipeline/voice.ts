import path from "node:path";
import type { VideoScript } from "../schema/script.js";
import type { TTSProvider, SynthesizedScene } from "../tts/types.js";
import type { AudioProcessor } from "../audio/ffmpeg.js";

export interface SynthesizeVoiceoverOptions {
  provider: TTSProvider;
  audioProcessor: AudioProcessor;
  outDir: string;
  voice: string;
}

export interface VoiceoverResult {
  /** Script with each scene's duration replaced by the ACTUAL audio
   * duration and estimatedDuration recomputed as their sum. This is now
   * the authoritative timeline -- never trim audio to fit the original
   * estimate. */
  script: VideoScript;
  scenes: SynthesizedScene[];
}

/**
 * Synthesizes narration for every scene, one file per scene (never a single
 * combined narration track, so a later partial re-render of one scene never
 * has to touch the others), normalises loudness, and overrides the script's
 * planned durations with the real audio durations.
 */
export async function synthesizeVoiceover(
  script: VideoScript,
  opts: SynthesizeVoiceoverOptions,
): Promise<VoiceoverResult> {
  const scenes: SynthesizedScene[] = [];

  for (const scene of script.scenes) {
    const rawPath = path.join(opts.outDir, `scene-${scene.id}.raw.wav`);
    const finalPath = path.join(opts.outDir, `scene-${scene.id}.wav`);

    const synthesized = await opts.provider.synthesizeScene({
      sceneId: scene.id,
      text: scene.narration,
      voice: opts.voice,
      language: script.language,
      outputPath: rawPath,
    });

    await opts.audioProcessor.normalizeLoudness(rawPath, finalPath);

    scenes.push({ ...synthesized, audioPath: finalPath });
  }

  const scenesById = new Map(scenes.map((s) => [s.sceneId, s]));
  const updatedScenes = script.scenes.map((scene) => {
    const synth = scenesById.get(scene.id);
    if (!synth) {
      throw new Error(`No synthesized audio found for scene ${scene.id}`);
    }
    return { ...scene, duration: synth.durationMs / 1000 };
  });

  const estimatedDuration = updatedScenes.reduce((sum, s) => sum + s.duration, 0);

  return {
    script: { ...script, scenes: updatedScenes, estimatedDuration },
    scenes,
  };
}
