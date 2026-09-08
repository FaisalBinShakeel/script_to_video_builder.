import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export interface AudioProcessor {
  /** Loudness-normalises `inputPath` to -16 LUFS, writing 48kHz mono WAV to `outputPath`. */
  normalizeLoudness(inputPath: string, outputPath: string): Promise<void>;
}

const TARGET_LUFS = -16;
const TRUE_PEAK_CEILING = -1.5;
const LOUDNESS_RANGE = 11;

/**
 * ffmpeg-backed AudioProcessor. TTS providers vary in output volume between
 * voices, so every scene is normalised the same way before it ever reaches
 * the mix step -- otherwise some videos come out noticeably quieter than
 * others depending on which voice was picked.
 */
export class FfmpegAudioProcessor implements AudioProcessor {
  constructor(
    private readonly execImpl: typeof execFile = execFile,
    private readonly ffmpegPath = "ffmpeg",
  ) {}

  async normalizeLoudness(inputPath: string, outputPath: string): Promise<void> {
    await this.execImpl(this.ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-af",
      `loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK_CEILING}:LRA=${LOUDNESS_RANGE}`,
      "-ar",
      "48000",
      "-ac",
      "1",
      outputPath,
    ]);
  }
}
