import { describe, it, expect, vi } from "vitest";
import { synthesizeVoiceover } from "./voice.js";
import type { TTSProvider, SynthesizedScene, SynthesizeSceneInput } from "../tts/types.js";
import type { AudioProcessor } from "../audio/ffmpeg.js";
import type { VideoScript } from "../schema/script.js";

function script(): VideoScript {
  return {
    title: "5 Benefits of Green Tea",
    language: "en",
    tone: "energetic",
    musicMood: "upbeat",
    scenes: [
      {
        id: 1,
        narration: "Green tea boosts your metabolism.",
        onScreenText: "Boost metabolism",
        searchKeywords: ["green tea cup", "person drinking tea"],
        duration: 5, // estimate, should be overridden
        emphasis: "hook",
      },
      {
        id: 2,
        narration: "Try one cup a day.",
        onScreenText: "Start today",
        searchKeywords: ["tea cup table", "person smiling tea"],
        duration: 5,
        emphasis: "cta",
      },
    ],
    estimatedDuration: 10,
  };
}

function fakeProvider(durationsMs: Record<number, number>): TTSProvider {
  return {
    synthesizeScene: vi.fn(
      async (input: SynthesizeSceneInput): Promise<SynthesizedScene> => ({
        sceneId: input.sceneId,
        audioPath: input.outputPath,
        durationMs: durationsMs[input.sceneId] ?? 1000,
        words: [{ text: "word", startMs: 0, endMs: 100 }],
      }),
    ),
  };
}

function fakeAudioProcessor(): AudioProcessor & { calls: [string, string][] } {
  const calls: [string, string][] = [];
  return {
    calls,
    normalizeLoudness: vi.fn(async (input: string, output: string) => {
      calls.push([input, output]);
    }),
  };
}

describe("synthesizeVoiceover", () => {
  it("overrides scene durations with the actual audio duration and recomputes the total", async () => {
    const provider = fakeProvider({ 1: 6200, 2: 3400 });
    const audioProcessor = fakeAudioProcessor();

    const result = await synthesizeVoiceover(script(), {
      provider,
      audioProcessor,
      outDir: "/tmp/out",
      voice: "en-US-JennyNeural",
    });

    expect(result.script.scenes[0]?.duration).toBeCloseTo(6.2);
    expect(result.script.scenes[1]?.duration).toBeCloseTo(3.4);
    expect(result.script.estimatedDuration).toBeCloseTo(9.6);
  });

  it("synthesizes one audio file per scene, never a combined file", async () => {
    const provider = fakeProvider({ 1: 1000, 2: 1000 });
    const audioProcessor = fakeAudioProcessor();

    await synthesizeVoiceover(script(), {
      provider,
      audioProcessor,
      outDir: "/tmp/out",
      voice: "en-US-JennyNeural",
    });

    expect(provider.synthesizeScene).toHaveBeenCalledTimes(2);
    const paths = (provider.synthesizeScene as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as SynthesizeSceneInput).outputPath,
    );
    expect(new Set(paths).size).toBe(2);
  });

  it("issues a loudness-normalisation call for every scene", async () => {
    const provider = fakeProvider({ 1: 1000, 2: 1000 });
    const audioProcessor = fakeAudioProcessor();

    const result = await synthesizeVoiceover(script(), {
      provider,
      audioProcessor,
      outDir: "/tmp/out",
      voice: "en-US-JennyNeural",
    });

    expect(audioProcessor.normalizeLoudness).toHaveBeenCalledTimes(2);
    // The final audio path returned must be the normalised output, not the raw file.
    expect(result.scenes[0]?.audioPath).toBe(audioProcessor.calls[0]?.[1]);
    expect(result.scenes[1]?.audioPath).toBe(audioProcessor.calls[1]?.[1]);
  });
});
