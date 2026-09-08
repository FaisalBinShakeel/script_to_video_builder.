import path from "node:path";
import { access, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { RenderVideoProps } from "./types.js";
import { sceneStartOffsetsMs, totalDurationMs } from "./types.js";
import { getTemplate } from "./templates/index.js";
import { deriveSfxEvents, resolveSfxFiles } from "./audio-mix/sfx.js";
import { buildAudioMixArgs, runAudioMix, muxVideoAndAudio } from "./audio-mix/mix.js";
import { webpackOverride } from "./webpack-override.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface RenderVideoOptions {
  outDir: string;
  sfxDir?: string;
  musicDir?: string;
  /** Path to a Chromium/Chrome executable. Defaults to
   * REMOTION_BROWSER_EXECUTABLE, then to Remotion's own managed download --
   * only needed when that download is blocked (e.g. a restricted sandbox). */
  browserExecutable?: string;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Renders a SocialVideo composition to a final MP4: Remotion renders the
 * (silent) video track, then ffmpeg builds the full narration+music+SFX mix
 * and muxes it in. Audio mixing intentionally never happens inside Remotion
 * -- see packages/video/src/audio-mix/mix.ts.
 */
export async function renderVideo(
  props: RenderVideoProps,
  opts: RenderVideoOptions,
): Promise<string> {
  await mkdir(opts.outDir, { recursive: true });

  const browserExecutable = opts.browserExecutable ?? process.env.REMOTION_BROWSER_EXECUTABLE;

  const bundleLocation = await bundle({
    entryPoint: path.join(here, "Root.tsx"),
    webpackOverride,
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SocialVideo",
    inputProps: props,
    browserExecutable,
  });

  const videoOnlyPath = path.join(opts.outDir, "video-only.mp4");
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: videoOnlyPath,
    inputProps: props,
    muted: true,
    browserExecutable,
  });

  const template = getTemplate(props.template);
  const offsets = sceneStartOffsetsMs(props.scenes);
  const sfxDir = opts.sfxDir ?? path.join(here, "../assets/sfx");
  const musicDir = opts.musicDir ?? path.join(here, "../assets/music");

  const narration = props.scenes.map((s, i) => ({
    audioPath: s.audio.audioPath,
    atMs: offsets[i] ?? 0,
  }));

  const sfxEvents = deriveSfxEvents(props.scenes);
  const resolvedSfx = resolveSfxFiles(sfxEvents, template.sfxMap, sfxDir);
  const existingSfx = [];
  for (const sfx of resolvedSfx) {
    if (await fileExists(sfx.filePath)) existingSfx.push(sfx);
  }

  const musicPath = path.join(musicDir, `${props.musicMood}.mp3`);
  const musicAvailable = await fileExists(musicPath);

  const mixedAudioPath = path.join(opts.outDir, "mixed-audio.m4a");
  await runAudioMix({
    narration,
    musicPath: musicAvailable ? musicPath : undefined,
    sfx: existingSfx,
    totalDurationMs: totalDurationMs(props.scenes),
    outputPath: mixedAudioPath,
  });

  const finalPath = path.join(opts.outDir, "output.mp4");
  await muxVideoAndAudio(videoOnlyPath, mixedAudioPath, finalPath);

  return finalPath;
}

export { buildAudioMixArgs };
