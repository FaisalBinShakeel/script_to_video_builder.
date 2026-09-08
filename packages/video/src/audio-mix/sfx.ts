import path from "node:path";
import type { SfxEventName, SfxMap } from "../templates/types.js";
import { sceneStartOffsetsMs, type RenderSceneInput } from "../types.js";

export interface SfxEvent {
  event: SfxEventName;
  atMs: number;
}

/**
 * Derives which SFX events fire and when, purely from the scene timeline --
 * SFX are template/mood driven, never chosen by the LLM.
 *
 *  - scene transition -> whoosh, at the start of every scene after the first.
 *  - text appears -> pop, shortly after every scene starts (aligned with
 *    the on-screen text entry animation).
 *  - hook -> impact, at the start of the hook scene.
 *  - final scene -> resolve hit, at the start of the CTA scene.
 */
export function deriveSfxEvents(scenes: RenderSceneInput[]): SfxEvent[] {
  const offsets = sceneStartOffsetsMs(scenes);
  const events: SfxEvent[] = [];

  scenes.forEach((s, i) => {
    const startMs = offsets[i] ?? 0;
    if (s.scene.emphasis === "hook") events.push({ event: "hook", atMs: startMs });
    events.push({ event: "textAppear", atMs: startMs + 100 });
    if (i > 0) events.push({ event: "sceneTransition", atMs: startMs });
    if (s.scene.emphasis === "cta") events.push({ event: "finalScene", atMs: startMs });
  });

  return events;
}

export interface ResolvedSfxEvent {
  event: SfxEventName;
  atMs: number;
  filePath: string;
}

/**
 * Resolves each event to a concrete file, rotating through the template's
 * variants for that event so repeated SFX (e.g. every scene transition)
 * don't sound identical.
 */
export function resolveSfxFiles(
  events: SfxEvent[],
  sfxMap: SfxMap,
  sfxDir: string,
): ResolvedSfxEvent[] {
  const counters: Partial<Record<SfxEventName, number>> = {};

  return events.map((e) => {
    const variants = sfxMap[e.event];
    const count = counters[e.event] ?? 0;
    counters[e.event] = count + 1;
    const variant = variants[count % variants.length];
    return {
      event: e.event,
      atMs: e.atMs,
      filePath: path.join(sfxDir, variant ?? ""),
    };
  });
}
