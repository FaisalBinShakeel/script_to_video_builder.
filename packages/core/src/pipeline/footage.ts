import type { Scene, VideoScript } from "../schema/script.js";
import type { AssetCache } from "../storage/asset-cache.js";
import { LocalAssetStorage } from "../storage/local-storage.js";

export type Orientation = "portrait" | "square" | "landscape";
export type FallbackLevel = "a" | "b" | "c" | "d";
export type FootageProviderName = "pexels" | "pixabay";

export interface FootageAttribution {
  provider: FootageProviderName;
  photographer?: string;
  photographerUrl?: string;
  sourceUrl: string;
}

export interface FootageClip {
  kind: "clip";
  provider: FootageProviderName;
  providerAssetId: string;
  fileUrl: string;
  width: number;
  height: number;
  durationSec: number;
  attribution: FootageAttribution;
}

export interface GradientMarker {
  kind: "gradient";
  /** Deterministic seed so the same scene always gets the same gradient. */
  seed: string;
}

export type SceneFootage = FootageClip | GradientMarker;

export interface SceneFootageResult {
  sceneId: number;
  footage: SceneFootage;
  fallbackLevel: FallbackLevel;
}

export interface RawFootageResult {
  provider: FootageProviderName;
  providerAssetId: string;
  fileUrl: string;
  width: number;
  height: number;
  durationSec: number;
  attribution: FootageAttribution;
}

export interface FootageSearchOptions {
  orientation: Orientation;
  /** Fetch failures throw by default; tests/CLI can opt into swallowing them. */
}

export interface FootageProviderClient {
  readonly name: FootageProviderName;
  search(
    keyword: string,
    opts: FootageSearchOptions,
  ): Promise<RawFootageResult[]>;
}

export function formatToOrientation(
  format: "portrait" | "square" | "landscape",
): Orientation {
  return format;
}

function meetsMinResolution(
  orientation: Orientation,
  width: number,
  height: number,
): boolean {
  if (orientation === "portrait") return height >= 1920 && width >= 1080;
  if (orientation === "landscape") return width >= 1920 && height >= 1080;
  return width >= 1080 && height >= 1080;
}

function assetKey(provider: FootageProviderName, providerAssetId: string): string {
  return `${provider}:${providerAssetId}`;
}

/**
 * Picks the best candidate for a scene: must meet the orientation/resolution
 * bar, must not already be used elsewhere in this video (dedup), and among
 * the survivors prefers a clip whose duration already covers the scene so
 * looping is avoided; only if none is long enough does it fall back to the
 * longest available.
 */
export function pickBestCandidate(
  candidates: RawFootageResult[],
  sceneDurationSec: number,
  usedAssetKeys: ReadonlySet<string>,
  orientation: Orientation,
): RawFootageResult | undefined {
  const eligible = candidates.filter(
    (c) =>
      meetsMinResolution(orientation, c.width, c.height) &&
      !usedAssetKeys.has(assetKey(c.provider, c.providerAssetId)),
  );
  if (eligible.length === 0) return undefined;

  const longEnough = eligible
    .filter((c) => c.durationSec >= sceneDurationSec)
    .sort((a, b) => a.durationSec - b.durationSec);
  if (longEnough[0]) return longEnough[0];

  return [...eligible].sort((a, b) => b.durationSec - a.durationSec)[0];
}

function deriveGenericKeyword(title: string): string {
  const stopwords = new Set([
    "the",
    "a",
    "an",
    "of",
    "for",
    "to",
    "and",
    "your",
    "you",
    "how",
    "why",
    "what",
]);
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w && !stopwords.has(w));
  return words.slice(0, 3).join(" ") || "abstract background";
}

export interface SelectFootageOptions {
  format: "portrait" | "square" | "landscape";
  pexels: FootageProviderClient;
  pixabay: FootageProviderClient;
  cache?: AssetCache;
  onFallback?: (result: SceneFootageResult) => void;
}

async function searchAll(
  client: FootageProviderClient,
  keywords: string[],
  orientation: Orientation,
): Promise<RawFootageResult[]> {
  const results = await Promise.all(
    keywords.map((kw) =>
      client.search(kw, { orientation }).catch(() => [] as RawFootageResult[]),
    ),
  );
  return results.flat();
}

/**
 * Selects one clip (or a gradient marker) per scene, following the fallback
 * chain: Pexels on the scene's own keywords -> Pixabay on the same keywords
 * -> Pexels on a generic keyword derived from the title -> a gradient
 * marker. Never returns the same asset twice within one call.
 */
export async function selectFootage(
  script: VideoScript,
  opts: SelectFootageOptions,
): Promise<SceneFootageResult[]> {
  const orientation = formatToOrientation(opts.format);
  const used = new Set<string>();
  const results: SceneFootageResult[] = [];

  for (const scene of script.scenes) {
    const result = await selectForScene(scene, script, orientation, used, opts);
    if (result.footage.kind === "clip") {
      used.add(assetKey(result.footage.provider, result.footage.providerAssetId));
    }
    opts.onFallback?.(result);
    results.push(result);
  }

  return results;
}

async function selectForScene(
  scene: Scene,
  script: VideoScript,
  orientation: Orientation,
  used: Set<string>,
  opts: SelectFootageOptions,
): Promise<SceneFootageResult> {
  // a. Pexels, own keyword variants.
  const pexelsOwn = await searchAll(opts.pexels, scene.searchKeywords, orientation);
  const a = pickBestCandidate(pexelsOwn, scene.duration, used, orientation);
  if (a) return { sceneId: scene.id, footage: await materialize(a, opts.cache), fallbackLevel: "a" };

  // b. Pixabay, same keyword variants.
  const pixabayOwn = await searchAll(opts.pixabay, scene.searchKeywords, orientation);
  const b = pickBestCandidate(pixabayOwn, scene.duration, used, orientation);
  if (b) return { sceneId: scene.id, footage: await materialize(b, opts.cache), fallbackLevel: "b" };

  // c. Pexels, generic keyword derived from the video title.
  const generic = deriveGenericKeyword(script.title);
  const pexelsGeneric = await searchAll(opts.pexels, [generic], orientation);
  const c = pickBestCandidate(pexelsGeneric, scene.duration, used, orientation);
  if (c) return { sceneId: scene.id, footage: await materialize(c, opts.cache), fallbackLevel: "c" };

  // d. Gradient background: no external asset, nothing to cache/dedup.
  return {
    sceneId: scene.id,
    footage: { kind: "gradient", seed: `scene-${scene.id}` },
    fallbackLevel: "d",
  };
}

async function materialize(
  raw: RawFootageResult,
  cache?: AssetCache,
): Promise<FootageClip> {
  const clip: FootageClip = {
    kind: "clip",
    provider: raw.provider,
    providerAssetId: raw.providerAssetId,
    fileUrl: raw.fileUrl,
    width: raw.width,
    height: raw.height,
    durationSec: raw.durationSec,
    attribution: raw.attribution,
  };
  if (cache) {
    await cache.ensureCached(raw);
  }
  return clip;
}

export function defaultAssetStorage(cacheDir: string): LocalAssetStorage {
  return new LocalAssetStorage(cacheDir);
}
