import type { RenderVideoProps } from "../types.js";

/** Fixture props for Remotion Studio previewing without running the full
 * pipeline. Uses a gradient background (fallback level 'd') for every scene
 * so the composition renders with zero external dependencies. */
export const sampleProps: RenderVideoProps = {
  title: "5 Benefits of Green Tea",
  template: "energetic",
  format: "portrait",
  musicMood: "upbeat",
  watermark: true,
  scenes: [
    {
      scene: {
        id: 1,
        narration: "Green tea is a metabolism booster you're sleeping on.",
        onScreenText: "Wake up your metabolism",
        searchKeywords: ["steaming cup green tea", "person drinking tea morning"],
        duration: 5,
        emphasis: "hook",
      },
      footage: { kind: "gradient", seed: "scene-1" },
      audio: {
        audioPath: "/tmp/scene-1.wav",
        durationMs: 5000,
        words: [
          { text: "Green", startMs: 0, endMs: 300 },
          { text: "tea", startMs: 300, endMs: 550 },
          { text: "is", startMs: 550, endMs: 700 },
          { text: "a", startMs: 700, endMs: 800 },
          { text: "metabolism", startMs: 800, endMs: 1400 },
          { text: "booster", startMs: 1400, endMs: 1900 },
          { text: "you're", startMs: 1900, endMs: 2200 },
          { text: "sleeping", startMs: 2200, endMs: 2700 },
          { text: "on.", startMs: 2700, endMs: 3000 },
        ],
      },
    },
    {
      scene: {
        id: 2,
        narration: "It's packed with antioxidants that fight cell damage.",
        onScreenText: "Loaded with antioxidants",
        searchKeywords: ["green tea leaves closeup", "person pouring tea"],
        duration: 5,
        emphasis: "normal",
      },
      footage: { kind: "gradient", seed: "scene-2" },
      audio: {
        audioPath: "/tmp/scene-2.wav",
        durationMs: 4500,
        words: [
          { text: "It's", startMs: 0, endMs: 300 },
          { text: "packed", startMs: 300, endMs: 700 },
          { text: "with", startMs: 700, endMs: 900 },
          { text: "antioxidants", startMs: 900, endMs: 1700 },
          { text: "that", startMs: 1700, endMs: 1900 },
          { text: "fight", startMs: 1900, endMs: 2200 },
          { text: "cell", startMs: 2200, endMs: 2450 },
          { text: "damage.", startMs: 2450, endMs: 2900 },
        ],
      },
    },
    {
      scene: {
        id: 3,
        narration: "Try one cup a day and feel the difference yourself.",
        onScreenText: "Start today",
        searchKeywords: ["person holding tea cup smiling", "tea cup on table"],
        duration: 5,
        emphasis: "cta",
      },
      footage: { kind: "gradient", seed: "scene-3" },
      audio: {
        audioPath: "/tmp/scene-3.wav",
        durationMs: 4800,
        words: [
          { text: "Try", startMs: 0, endMs: 250 },
          { text: "one", startMs: 250, endMs: 450 },
          { text: "cup", startMs: 450, endMs: 700 },
          { text: "a", startMs: 700, endMs: 800 },
          { text: "day", startMs: 800, endMs: 1100 },
          { text: "and", startMs: 1100, endMs: 1300 },
          { text: "feel", startMs: 1300, endMs: 1600 },
          { text: "the", startMs: 1600, endMs: 1750 },
          { text: "difference", startMs: 1750, endMs: 2400 },
          { text: "yourself.", startMs: 2400, endMs: 3000 },
        ],
      },
    },
  ],
};
