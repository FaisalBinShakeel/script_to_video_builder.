#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import { loadEnv, parseArgs } from "./util.js";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const scriptPath = args.script;
if (!scriptPath) {
  console.error("Usage: pnpm footage:test -- --script ./out/script.json [--format portrait]");
  process.exit(1);
}

const { VideoScriptSchema } = await import("../schema/script.js");
const { selectFootage, defaultAssetStorage } = await import("../pipeline/footage.js");
const { AssetCache } = await import("../storage/asset-cache.js");
const { PexelsClient } = await import("../providers/pexels.js");
const { PixabayClient } = await import("../providers/pixabay.js");

const raw = JSON.parse(await readFile(scriptPath, "utf-8"));
const script = VideoScriptSchema.parse(raw);

const pexelsKey = process.env.PEXELS_API_KEY;
const pixabayKey = process.env.PIXABAY_API_KEY;
if (!pexelsKey || !pixabayKey) {
  console.error("PEXELS_API_KEY and PIXABAY_API_KEY must be set.");
  process.exit(1);
}

const cache = new AssetCache(defaultAssetStorage("./.cache/footage"));

const results = await selectFootage(script, {
  format: (args.format as "portrait" | "square" | "landscape") ?? "portrait",
  pexels: new PexelsClient(pexelsKey),
  pixabay: new PixabayClient(pixabayKey),
  cache,
});

for (const r of results) {
  const url = r.footage.kind === "clip" ? r.footage.fileUrl : `gradient:${r.footage.seed}`;
  console.log(`scene ${r.sceneId}  fallback=${r.fallbackLevel}  ${url}`);
}
