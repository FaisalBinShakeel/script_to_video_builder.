import { describe, it, expect } from "vitest";
import { deriveSfxEvents, resolveSfxFiles } from "./sfx.js";
import { TEMPLATES } from "../templates/index.js";
import type { RenderSceneInput } from "../types.js";

function sceneInput(
  id: number,
  emphasis: "hook" | "normal" | "cta",
  durationMs: number,
): RenderSceneInput {
  return {
    scene: {
      id,
      narration: "narration",
      onScreenText: "text",
      searchKeywords: ["a b", "c d"],
      duration: durationMs / 1000,
      emphasis,
    },
    footage: { kind: "gradient", seed: `scene-${id}` },
    audio: { audioPath: `/tmp/scene-${id}.wav`, durationMs, words: [] },
  };
}

describe("deriveSfxEvents", () => {
  it("fires hook at scene 1, transitions between scenes, and finalScene at the cta scene", () => {
    const scenes = [
      sceneInput(1, "hook", 3000),
      sceneInput(2, "normal", 2000),
      sceneInput(3, "cta", 2500),
    ];

    const events = deriveSfxEvents(scenes);

    expect(events).toContainEqual({ event: "hook", atMs: 0 });
    expect(events).toContainEqual({ event: "sceneTransition", atMs: 3000 });
    expect(events).toContainEqual({ event: "sceneTransition", atMs: 5000 });
    expect(events).toContainEqual({ event: "finalScene", atMs: 5000 });
    // textAppear fires shortly after every scene start.
    expect(events.filter((e) => e.event === "textAppear")).toHaveLength(3);
    // No transition event before the very first scene.
    expect(events.filter((e) => e.event === "sceneTransition")).toHaveLength(2);
  });
});

describe("resolveSfxFiles", () => {
  it("rotates through the template's variants so repeats aren't identical", () => {
    const sfxMap = TEMPLATES.energetic.sfxMap;
    const events = [
      { event: "sceneTransition" as const, atMs: 1000 },
      { event: "sceneTransition" as const, atMs: 2000 },
      { event: "sceneTransition" as const, atMs: 3000 },
      { event: "sceneTransition" as const, atMs: 4000 },
    ];

    const resolved = resolveSfxFiles(events, sfxMap, "/sfx");
    const files = resolved.map((r) => r.filePath);

    // 3 whoosh variants, 4 events -> the 4th wraps back to the 1st variant.
    expect(files[0]).toBe(files[3]);
    expect(new Set(files.slice(0, 3)).size).toBe(3);
  });

  it("resolves each event independently against its own counter", () => {
    const sfxMap = TEMPLATES.professional.sfxMap;
    const events = [
      { event: "hook" as const, atMs: 0 },
      { event: "textAppear" as const, atMs: 100 },
    ];
    const resolved = resolveSfxFiles(events, sfxMap, "/sfx");
    expect(resolved[0]?.filePath).toContain(sfxMap.hook[0]);
    expect(resolved[1]?.filePath).toContain(sfxMap.textAppear[0]);
  });
});
