import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeWordBoundaryEvent {
  text: string;
  audioOffset: number;
  duration: number;
}
type WordBoundaryHandler = (
  sender: unknown,
  e: FakeWordBoundaryEvent,
) => void;

let lastSynthesizer: FakeSynthesizer | undefined;
let nextResult: { reason: string; audioDuration: number; errorDetails?: string } = {
  reason: "completed",
  audioDuration: 50_000_000, // 5000ms
};
let nextError: Error | undefined;

class FakeSynthesizer {
  wordBoundary: WordBoundaryHandler | undefined;
  closed = false;

  constructor() {
    lastSynthesizer = this;
  }

  speakTextAsync(
    _text: string,
    onSuccess: (result: typeof nextResult) => void,
    onError: (err: unknown) => void,
  ) {
    if (nextError) {
      onError(nextError);
      return;
    }
    this.wordBoundary?.(undefined, { text: "Hello", audioOffset: 0, duration: 2_500_000 });
    this.wordBoundary?.(undefined, {
      text: "world",
      audioOffset: 2_500_000,
      duration: 3_000_000,
    });
    onSuccess(nextResult);
  }

  close() {
    this.closed = true;
  }
}

vi.mock("microsoft-cognitiveservices-speech-sdk", () => ({
  SpeechConfig: {
    fromSubscription: vi.fn(() => ({}) as { speechSynthesisVoiceName?: string; speechSynthesisOutputFormat?: unknown }),
  },
  AudioConfig: { fromAudioFileOutput: vi.fn(() => ({})) },
  SpeechSynthesizer: vi.fn(function (this: unknown) {
    return new FakeSynthesizer();
  }),
  SpeechSynthesisOutputFormat: { Riff48Khz16BitMonoPcm: "riff48khz16bitmonopcm" },
  ResultReason: { SynthesizingAudioCompleted: "completed" },
}));

const { AzureTTSProvider, AzureTTSError } = await import("./azure.js");

beforeEach(() => {
  lastSynthesizer = undefined;
  nextError = undefined;
  nextResult = { reason: "completed", audioDuration: 50_000_000 };
});

describe("AzureTTSProvider", () => {
  it("extracts word timings from wordBoundary events, converting ticks to ms", async () => {
    const provider = new AzureTTSProvider("key", "region");
    const result = await provider.synthesizeScene({
      sceneId: 1,
      text: "Hello world",
      voice: "en-US-JennyNeural",
      language: "en",
      outputPath: "/tmp/scene-1.wav",
    });

    expect(result.words).toEqual([
      { text: "Hello", startMs: 0, endMs: 250 },
      { text: "world", startMs: 250, endMs: 550 },
    ]);
  });

  it("converts audioDuration ticks to milliseconds", async () => {
    const provider = new AzureTTSProvider("key", "region");
    const result = await provider.synthesizeScene({
      sceneId: 1,
      text: "Hello world",
      voice: "en-US-JennyNeural",
      language: "en",
      outputPath: "/tmp/scene-1.wav",
    });

    expect(result.durationMs).toBe(5000);
    expect(result.sceneId).toBe(1);
    expect(result.audioPath).toBe("/tmp/scene-1.wav");
  });

  it("closes the synthesizer after a successful synthesis", async () => {
    const provider = new AzureTTSProvider("key", "region");
    await provider.synthesizeScene({
      sceneId: 1,
      text: "Hello",
      voice: "en-US-JennyNeural",
      language: "en",
      outputPath: "/tmp/scene-1.wav",
    });

    expect(lastSynthesizer?.closed).toBe(true);
  });

  it("rejects with AzureTTSError when synthesis does not complete", async () => {
    nextResult = { reason: "error", audioDuration: 0, errorDetails: "boom" };
    const provider = new AzureTTSProvider("key", "region");

    await expect(
      provider.synthesizeScene({
        sceneId: 2,
        text: "Hello",
        voice: "en-US-JennyNeural",
        language: "en",
        outputPath: "/tmp/scene-2.wav",
      }),
    ).rejects.toThrow(AzureTTSError);
  });

  it("rejects with AzureTTSError on a synthesizer error callback", async () => {
    nextError = new Error("network down");
    const provider = new AzureTTSProvider("key", "region");

    await expect(
      provider.synthesizeScene({
        sceneId: 3,
        text: "Hello",
        voice: "en-US-JennyNeural",
        language: "en",
        outputPath: "/tmp/scene-3.wav",
      }),
    ).rejects.toThrow(AzureTTSError);
  });
});
