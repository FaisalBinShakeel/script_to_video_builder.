import { describe, it, expect, vi } from "vitest";
import { selectFootage, pickBestCandidate, type RawFootageResult } from "./footage.js";
import { AssetCache, type AssetStorage } from "../storage/asset-cache.js";
import type { VideoScript } from "../schema/script.js";

function scene(id: number, keywords: string[]) {
  return {
    id,
    narration: `narration ${id}`,
    onScreenText: `text ${id}`,
    searchKeywords: keywords,
    duration: 5,
    emphasis: "normal" as const,
  };
}

function script(scenes: ReturnType<typeof scene>[]): VideoScript {
  return {
    title: "5 Benefits of Green Tea",
    language: "en",
    tone: "energetic",
    musicMood: "upbeat",
    scenes,
    estimatedDuration: scenes.length * 5,
  };
}

function clip(overrides: Partial<RawFootageResult> = {}): RawFootageResult {
  return {
    provider: "pexels",
    providerAssetId: "1",
    fileUrl: "https://example.com/1.mp4",
    width: 1080,
    height: 1920,
    durationSec: 6,
    attribution: { provider: "pexels", sourceUrl: "https://pexels.com/1" },
    ...overrides,
  };
}

function mockClient(
  name: "pexels" | "pixabay",
  impl: (keyword: string) => Promise<RawFootageResult[]>,
) {
  return { name, search: (keyword: string) => impl(keyword) };
}

describe("pickBestCandidate", () => {
  it("prefers a clip whose duration already covers the scene", () => {
    const short = clip({ providerAssetId: "short", durationSec: 3 });
    const long = clip({ providerAssetId: "long", durationSec: 8 });
    const picked = pickBestCandidate([short, long], 5, new Set(), "portrait");
    expect(picked?.providerAssetId).toBe("long");
  });

  it("filters below the minimum resolution for the orientation", () => {
    const lowRes = clip({ providerAssetId: "low", width: 640, height: 360 });
    const picked = pickBestCandidate([lowRes], 5, new Set(), "portrait");
    expect(picked).toBeUndefined();
  });

  it("skips already-used assets (dedup)", () => {
    const used = new Set(["pexels:1"]);
    const only = clip({ providerAssetId: "1" });
    const picked = pickBestCandidate([only], 5, used, "portrait");
    expect(picked).toBeUndefined();
  });
});

describe("selectFootage", () => {
  it("hits fallback level 'a' when Pexels finds a match on the scene's own keywords", async () => {
    const pexels = mockClient("pexels", async () => [clip()]);
    const pixabay = mockClient("pixabay", async () => []);

    const s = script([scene(1, ["tea cup", "green tea"])]);
    const results = await selectFootage(s, { format: "portrait", pexels, pixabay });

    expect(results).toHaveLength(1);
    expect(results[0]?.fallbackLevel).toBe("a");
  });

  it("falls back through pexels -> pixabay -> generic -> gradient when everything empty", async () => {
    const pexels = mockClient("pexels", async () => []);
    const pixabay = mockClient("pixabay", async () => []);

    const s = script([scene(1, ["tea cup", "green tea"])]);
    const results = await selectFootage(s, { format: "portrait", pexels, pixabay });

    expect(results[0]?.fallbackLevel).toBe("d");
    expect(results[0]?.footage.kind).toBe("gradient");
  });

  it("falls back to pixabay (level b) when pexels has nothing", async () => {
    const pexels = mockClient("pexels", async () => []);
    const pixabay = mockClient("pixabay", async (kw) =>
      kw === "tea cup" ? [clip({ provider: "pixabay", providerAssetId: "9" })] : [],
    );

    const s = script([scene(1, ["tea cup", "green tea"])]);
    const results = await selectFootage(s, { format: "portrait", pexels, pixabay });

    expect(results[0]?.fallbackLevel).toBe("b");
  });

  it("never returns the same asset twice within one video", async () => {
    const pexels = mockClient("pexels", async () => [clip({ providerAssetId: "1" })]);
    const pixabay = mockClient("pixabay", async () => []);

    const s = script([
      scene(1, ["tea cup"]),
      scene(2, ["tea leaves"]),
    ]);
    const results = await selectFootage(s, { format: "portrait", pexels, pixabay });

    expect(results[0]?.fallbackLevel).toBe("a");
    // Scene 2 can't reuse asset "1", and nothing else is available, so it
    // must fall all the way through to a gradient.
    expect(results[1]?.fallbackLevel).toBe("d");
  });

  it("caches downloaded assets and skips re-downloading on a cache hit", async () => {
    const store = new Map<string, Buffer>();
    const storage: AssetStorage = {
      has: async (key) => store.has(key),
      put: async (key, data) => {
        store.set(key, data);
        return { key, url: key };
      },
    };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "video/mp4" }),
      arrayBuffer: async () => new ArrayBuffer(4),
    })) as unknown as typeof fetch;

    const cache = new AssetCache(storage, fetchImpl);
    const asset = { provider: "pexels", providerAssetId: "1", fileUrl: "https://x/1.mp4" };

    await cache.ensureCached(asset);
    await cache.ensureCached(asset);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
