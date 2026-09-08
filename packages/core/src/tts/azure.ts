import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import type {
  TTSProvider,
  SynthesizeSceneInput,
  SynthesizedScene,
  WordTiming,
} from "./types.js";

export class AzureTTSError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AzureTTSError";
  }
}

/**
 * Azure Cognitive Services Speech TTS. Synthesizes one scene at a time to
 * its own WAV file (never a combined file, per the pipeline's partial
 * re-render requirement) and captures word-boundary events so caption
 * animation downstream can be driven by real timings instead of estimated
 * character counts.
 */
export class AzureTTSProvider implements TTSProvider {
  constructor(
    private readonly subscriptionKey: string,
    private readonly region: string,
  ) {}

  async synthesizeScene(input: SynthesizeSceneInput): Promise<SynthesizedScene> {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      this.subscriptionKey,
      this.region,
    );
    speechConfig.speechSynthesisVoiceName = input.voice;
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm;

    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(input.outputPath);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    const words: WordTiming[] = [];
    // audioOffset/duration are in 100-nanosecond ticks; /10000 -> ms.
    synthesizer.wordBoundary = (_sender, e) => {
      words.push({
        text: e.text,
        startMs: e.audioOffset / 10000,
        endMs: (e.audioOffset + e.duration) / 10000,
      });
    };

    return new Promise<SynthesizedScene>((resolve, reject) => {
      synthesizer.speakTextAsync(
        input.text,
        (result) => {
          synthesizer.close();
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve({
              sceneId: input.sceneId,
              audioPath: input.outputPath,
              durationMs: result.audioDuration / 10000,
              words,
            });
          } else {
            reject(
              new AzureTTSError(
                `Azure TTS failed for scene ${input.sceneId}: ${result.errorDetails}`,
              ),
            );
          }
        },
        (err) => {
          synthesizer.close();
          reject(new AzureTTSError(`Azure TTS error for scene ${input.sceneId}`, err));
        },
      );
    });
  }
}
