#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../../.env") });

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input;
if (!inputPath) {
  console.error("Usage: pnpm video:render -- --input ./out/pipeline.json [--out ./out]");
  process.exit(1);
}

const { renderVideo } = await import("../render.js");
const { RenderVideoPropsSchema } = await import("../types.js");

const raw = JSON.parse(await readFile(inputPath, "utf-8"));
const props = RenderVideoPropsSchema.parse(raw);

const outDir = path.resolve(args.out ?? "./out");

const outputPath = await renderVideo(props, { outDir });
console.log(`Rendered: ${outputPath}`);
