import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { dbToAmplitude } from "./db.js";
import type { ResolvedSfxEvent } from "./sfx.js";

const execFile = promisify(execFileCb);

export interface NarrationInput {
  audioPath: string;
  atMs: number;
}

export interface AudioMixInput {
  narration: NarrationInput[];
  /** Background music track for the video's musicMood. Optional: if not
   * supplied (assets/music/<mood>.mp3 missing), the mix proceeds with
   * narration + SFX only. */
  musicPath?: string;
  sfx: ResolvedSfxEvent[];
  totalDurationMs: number;
  outputPath: string;
  musicDuckedDb?: number;
  musicNormalDb?: number;
  sfxDb?: number;
  truePeakCeilingDb?: number;
}

const DEFAULTS = {
  musicDuckedDb: -18,
  musicNormalDb: -8,
  sfxDb: -12,
  truePeakCeilingDb: -1,
};

export interface BuiltAudioMix {
  ffmpegArgs: string[];
  inputFiles: string[];
}

/**
 * Builds the ffmpeg args for the full audio mix, done entirely in ffmpeg
 * (never inside Remotion, per the non-negotiable rendering rule):
 *  - each scene's narration WAV, already at -16 LUFS (phase 3), delayed to
 *    its absolute offset in the timeline and summed;
 *  - the mood music bed, sidechain-ducked under the narration (approx.
 *    -18dB while narration plays, -8dB elsewhere -- true per-segment gain
 *    automation isn't expressible as one static filter, so sidechaincompress
 *    is tuned to approximate it; revisit with real assets if it needs
 *    tightening);
 *  - each SFX one-shot at -12dB, delayed to its event timestamp, rotating
 *    template variants so repeats aren't obviously identical;
 *  - a final limiter at a -1dBTP ceiling, encoded to AAC 128kbps.
 */
export function buildAudioMixArgs(input: AudioMixInput): BuiltAudioMix {
  if (input.narration.length === 0) {
    throw new Error("buildAudioMixArgs requires at least one narration input");
  }
  const opts = { ...DEFAULTS, ...input };

  const inputFiles: string[] = [...input.narration.map((n) => n.audioPath)];
  const narrationLabels = input.narration.map((_, i) => {
    return `n${i}`;
  });

  const filters: string[] = input.narration.map(
    (n, i) => `[${i}:a]adelay=${Math.round(n.atMs)}:all=1[n${i}]`,
  );

  let narrBusLabel: string;
  if (narrationLabels.length === 1) {
    narrBusLabel = narrationLabels[0] as string;
  } else {
    narrBusLabel = "narrbus";
    filters.push(
      `${narrationLabels.map((l) => `[${l}]`).join("")}amix=inputs=${narrationLabels.length}:normalize=0[${narrBusLabel}]`,
    );
  }

  let musicLabel: string | undefined;
  if (input.musicPath) {
    const musicIndex = inputFiles.length;
    inputFiles.push(input.musicPath);
    filters.push(`[${musicIndex}:a]volume=${dbToAmplitude(opts.musicNormalDb)}[musicbase]`);
    filters.push(
      `[musicbase][${narrBusLabel}]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=300[duckedmusic]`,
    );
    musicLabel = "duckedmusic";
  }

  const sfxLabels: string[] = [];
  for (const sfx of input.sfx) {
    const idx = inputFiles.length;
    inputFiles.push(sfx.filePath);
    const label = `sfx${sfxLabels.length}`;
    filters.push(
      `[${idx}:a]adelay=${Math.round(sfx.atMs)}:all=1,volume=${dbToAmplitude(opts.sfxDb)}[${label}]`,
    );
    sfxLabels.push(label);
  }

  const finalInputs = [narrBusLabel, ...(musicLabel ? [musicLabel] : []), ...sfxLabels];
  const limiterLimit = dbToAmplitude(opts.truePeakCeilingDb);

  if (finalInputs.length === 1) {
    filters.push(`[${finalInputs[0]}]alimiter=limit=${limiterLimit}[out]`);
  } else {
    filters.push(
      `${finalInputs.map((l) => `[${l}]`).join("")}amix=inputs=${finalInputs.length}:normalize=0,alimiter=limit=${limiterLimit}[out]`,
    );
  }

  const ffmpegArgs = [
    "-y",
    ...inputFiles.flatMap((f) => ["-i", f]),
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-t",
    (input.totalDurationMs / 1000).toFixed(3),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    input.outputPath,
  ];

  return { ffmpegArgs, inputFiles };
}

export async function runAudioMix(
  input: AudioMixInput,
  execImpl: typeof execFile = execFile,
  ffmpegPath = "ffmpeg",
): Promise<void> {
  const { ffmpegArgs } = buildAudioMixArgs(input);
  await execImpl(ffmpegPath, ffmpegArgs);
}

/** Muxes the (silent) rendered video with the final mixed audio track. */
export async function muxVideoAndAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  execImpl: typeof execFile = execFile,
  ffmpegPath = "ffmpeg",
): Promise<void> {
  await execImpl(ffmpegPath, [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-shortest",
    outputPath,
  ]);
}
