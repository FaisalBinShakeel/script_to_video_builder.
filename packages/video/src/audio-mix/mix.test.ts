import { describe, it, expect, vi } from "vitest";
import { buildAudioMixArgs, runAudioMix, muxVideoAndAudio } from "./mix.js";

describe("buildAudioMixArgs", () => {
  it("delays a single narration input to its offset and applies the limiter", () => {
    const { ffmpegArgs, inputFiles } = buildAudioMixArgs({
      narration: [{ audioPath: "/n1.wav", atMs: 0 }],
      sfx: [],
      totalDurationMs: 5000,
      outputPath: "/out.m4a",
    });

    expect(inputFiles).toEqual(["/n1.wav"]);
    const filterComplex = ffmpegArgs[ffmpegArgs.indexOf("-filter_complex") + 1];
    expect(filterComplex).toContain("adelay=0:all=1[n0]");
    expect(filterComplex).toContain("alimiter=limit=");
    expect(filterComplex).toContain("[out]");
    expect(ffmpegArgs).toContain("aac");
    expect(ffmpegArgs).toContain("128k");
  });

  it("mixes multiple narration inputs via amix before the limiter", () => {
    const { ffmpegArgs } = buildAudioMixArgs({
      narration: [
        { audioPath: "/n1.wav", atMs: 0 },
        { audioPath: "/n2.wav", atMs: 4000 },
      ],
      sfx: [],
      totalDurationMs: 8000,
      outputPath: "/out.m4a",
    });

    const filterComplex = ffmpegArgs[ffmpegArgs.indexOf("-filter_complex") + 1];
    expect(filterComplex).toContain("adelay=0:all=1[n0]");
    expect(filterComplex).toContain("adelay=4000:all=1[n1]");
    expect(filterComplex).toContain("amix=inputs=2:normalize=0[narrbus]");
  });

  it("sidechain-ducks music under the narration bus when a music track is supplied", () => {
    const { ffmpegArgs, inputFiles } = buildAudioMixArgs({
      narration: [{ audioPath: "/n1.wav", atMs: 0 }],
      musicPath: "/upbeat.mp3",
      sfx: [],
      totalDurationMs: 5000,
      outputPath: "/out.m4a",
    });

    expect(inputFiles).toEqual(["/n1.wav", "/upbeat.mp3"]);
    const filterComplex = ffmpegArgs[ffmpegArgs.indexOf("-filter_complex") + 1];
    expect(filterComplex).toContain("sidechaincompress");
    expect(filterComplex).toContain("[musicbase][n0]");
  });

  it("omits music entirely when no track is supplied", () => {
    const { ffmpegArgs, inputFiles } = buildAudioMixArgs({
      narration: [{ audioPath: "/n1.wav", atMs: 0 }],
      sfx: [],
      totalDurationMs: 5000,
      outputPath: "/out.m4a",
    });

    expect(inputFiles).not.toContain(undefined);
    const filterComplex = ffmpegArgs[ffmpegArgs.indexOf("-filter_complex") + 1];
    expect(filterComplex).not.toContain("sidechaincompress");
  });

  it("delays each SFX one-shot to its event timestamp at -12dB", () => {
    const { ffmpegArgs, inputFiles } = buildAudioMixArgs({
      narration: [{ audioPath: "/n1.wav", atMs: 0 }],
      sfx: [
        { event: "hook", atMs: 0, filePath: "/sfx/impact-1.mp3" },
        { event: "sceneTransition", atMs: 3000, filePath: "/sfx/whoosh-1.mp3" },
      ],
      totalDurationMs: 8000,
      outputPath: "/out.m4a",
    });

    expect(inputFiles).toEqual(["/n1.wav", "/sfx/impact-1.mp3", "/sfx/whoosh-1.mp3"]);
    const filterComplex = ffmpegArgs[ffmpegArgs.indexOf("-filter_complex") + 1];
    expect(filterComplex).toContain("adelay=0:all=1,volume=");
    expect(filterComplex).toContain("adelay=3000:all=1,volume=");
  });

  it("throws with no narration inputs", () => {
    expect(() =>
      buildAudioMixArgs({ narration: [], sfx: [], totalDurationMs: 1000, outputPath: "/out.m4a" }),
    ).toThrow();
  });
});

describe("runAudioMix / muxVideoAndAudio", () => {
  it("invokes ffmpeg with the built args", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "" })) as never;
    await runAudioMix(
      { narration: [{ audioPath: "/n1.wav", atMs: 0 }], sfx: [], totalDurationMs: 5000, outputPath: "/out.m4a" },
      exec,
      "ffmpeg",
    );
    expect(exec).toHaveBeenCalledTimes(1);
    const [bin, args] = (exec as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string[],
    ];
    expect(bin).toBe("ffmpeg");
    expect(args).toContain("/out.m4a");
  });

  it("muxes video and audio with stream copy", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "" })) as never;
    await muxVideoAndAudio("/v.mp4", "/a.m4a", "/final.mp4", exec, "ffmpeg");
    const [, args] = (exec as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string[],
    ];
    expect(args).toEqual(
      expect.arrayContaining(["-i", "/v.mp4", "-i", "/a.m4a", "-shortest", "/final.mp4"]),
    );
  });
});
