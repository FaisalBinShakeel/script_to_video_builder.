export interface WordTiming {
  text: string;
  startMs: number;
  endMs: number;
}

export interface SynthesizeSceneInput {
  sceneId: number;
  text: string;
  voice: string;
  language: string;
  /** Where the raw synthesized WAV should be written. */
  outputPath: string;
}

export interface SynthesizedScene {
  sceneId: number;
  audioPath: string;
  durationMs: number;
  words: WordTiming[];
}

/**
 * Abstraction over a TTS backend. Azure is the only implementation today;
 * an ElevenLabs premium path can be added later as a second implementation
 * without any pipeline caller changing.
 */
export interface TTSProvider {
  synthesizeScene(input: SynthesizeSceneInput): Promise<SynthesizedScene>;
}
