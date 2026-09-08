import type { CaptionWord } from "../types.js";

/** Index of the word active at `currentMs`, or -1 if none (before the first
 * word starts, or after the last word ends). */
export function getActiveWordIndex(words: CaptionWord[], currentMs: number): number {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w && currentMs >= w.startMs && currentMs < w.endMs) return i;
  }
  return -1;
}

/** Groups words into caption lines of at most `maxWords`, without splitting
 * a word's own timing -- used by the classic-bar style so a full line is
 * shown while the active word within it is highlighted. */
export function groupIntoLines(
  words: CaptionWord[],
  maxWords: number,
): CaptionWord[][] {
  const lines: CaptionWord[][] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    lines.push(words.slice(i, i + maxWords));
  }
  return lines;
}

/** The line (per groupIntoLines) that contains `currentMs`, or the closest
 * line if currentMs falls in a gap between words. */
export function getActiveLine(
  words: CaptionWord[],
  currentMs: number,
  maxWords: number,
): CaptionWord[] | undefined {
  const lines = groupIntoLines(words, maxWords);
  for (const line of lines) {
    const first = line[0];
    const last = line[line.length - 1];
    if (first && last && currentMs >= first.startMs && currentMs < last.endMs) {
      return line;
    }
  }
  if (currentMs < (words[0]?.startMs ?? 0)) return lines[0];
  return lines[lines.length - 1];
}

/** Fraction (0-1) of a single word's karaoke fill progress at `currentMs`. */
export function wordFillProgress(word: CaptionWord, currentMs: number): number {
  if (currentMs <= word.startMs) return 0;
  if (currentMs >= word.endMs) return 1;
  const span = word.endMs - word.startMs;
  if (span <= 0) return 1;
  return (currentMs - word.startMs) / span;
}
