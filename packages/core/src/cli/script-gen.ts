#!/usr/bin/env tsx
import { loadEnv, parseArgs } from "./util.js";

loadEnv();

const { generateScript } = await import("../pipeline/script.js");

const args = parseArgs(process.argv.slice(2));

const topic = args.topic;
if (!topic) {
  console.error(
    'Usage: pnpm script:gen -- --topic "5 benefits of green tea" [--tone energetic] [--language en] [--targetDuration 30] [--format portrait]',
  );
  process.exit(1);
}

const input = {
  topic,
  tone: (args.tone ?? "energetic") as
    | "energetic"
    | "professional"
    | "calm"
    | "story",
  language: (args.language ?? "en") as "en" | "ur",
  targetDuration: Number(args.targetDuration ?? 30) as 15 | 30 | 45 | 60,
  format: (args.format ?? "portrait") as "portrait" | "square" | "landscape",
};

try {
  const script = await generateScript(input);
  console.log(JSON.stringify(script, null, 2));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
