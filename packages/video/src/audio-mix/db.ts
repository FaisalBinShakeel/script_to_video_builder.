/** Converts a dB value to a linear amplitude multiplier for ffmpeg's `volume` filter. */
export function dbToAmplitude(db: number): number {
  return Math.pow(10, db / 20);
}
