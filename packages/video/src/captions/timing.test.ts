import { describe, it, expect } from "vitest";
import { getActiveWordIndex, groupIntoLines, getActiveLine, wordFillProgress } from "./timing.js";
import type { CaptionWord } from "../types.js";

const words: CaptionWord[] = [
  { text: "Green", startMs: 0, endMs: 300 },
  { text: "tea", startMs: 300, endMs: 550 },
  { text: "boosts", startMs: 550, endMs: 900 },
  { text: "your", startMs: 900, endMs: 1050 },
  { text: "metabolism.", startMs: 1050, endMs: 1700 },
];

describe("getActiveWordIndex", () => {
  it("finds the word active at a given time", () => {
    expect(getActiveWordIndex(words, 400)).toBe(1);
    expect(getActiveWordIndex(words, 0)).toBe(0);
  });

  it("returns -1 before the first word and after the last", () => {
    expect(getActiveWordIndex(words, -10)).toBe(-1);
    expect(getActiveWordIndex(words, 5000)).toBe(-1);
  });
});

describe("groupIntoLines", () => {
  it("chunks words without splitting a word's timing", () => {
    const lines = groupIntoLines(words, 2);
    expect(lines).toEqual([
      [words[0], words[1]],
      [words[2], words[3]],
      [words[4]],
    ]);
  });
});

describe("getActiveLine", () => {
  it("returns the line containing the current time", () => {
    const line = getActiveLine(words, 600, 2);
    expect(line?.map((w) => w.text)).toEqual(["boosts", "your"]);
  });

  it("falls back to the first line before any word starts", () => {
    const line = getActiveLine(words, -100, 2);
    expect(line?.map((w) => w.text)).toEqual(["Green", "tea"]);
  });

  it("falls back to the last line after all words end", () => {
    const line = getActiveLine(words, 9999, 2);
    expect(line?.map((w) => w.text)).toEqual(["metabolism."]);
  });
});

describe("wordFillProgress", () => {
  it("is 0 before the word starts and 1 after it ends", () => {
    const word = words[1] as CaptionWord;
    expect(wordFillProgress(word, 0)).toBe(0);
    expect(wordFillProgress(word, 1000)).toBe(1);
  });

  it("interpolates linearly across the word's span", () => {
    const word = words[1] as CaptionWord; // 300-550
    expect(wordFillProgress(word, 425)).toBeCloseTo(0.5);
  });
});
