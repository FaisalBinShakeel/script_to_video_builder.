#!/usr/bin/env tsx
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv, parseArgs } from "./util.js";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const scriptPath = args.script;
if (!scriptPath) {
  console.error(
    "Usage: pnpm voice:test -- --script ./out/script.json [--voice en-US-JennyNeural] [--out ./out/audio]",
  );
  process.exit(1);
}

const { VideoScriptSchema } = await import("../schema/script.js");
const { synthesizeVoiceover } = await import("../pipeline/voice.js");
const { AzureTTSProvider } = await import("../tts/azure.js");
const { FfmpegAudioProcessor } = await import("../audio/ffmpeg.js");

const raw = JSON.parse(await readFile(scriptPath, "utf-8"));
const script = VideoScriptSchema.parse(raw);

const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
if (!key || !region) {
  console.error("AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set.");
  process.exit(1);
}

const outDir = path.resolve(args.out ?? "./out/audio");
await mkdir(outDir, { recursive: true });

const result = await synthesizeVoiceover(script, {
  provider: new AzureTTSProvider(key, region),
  audioProcessor: new FfmpegAudioProcessor(),
  outDir,
  voice: args.voice ?? "en-US-JennyNeural",
});

for (const scene of result.scenes) {
  console.log(
    `scene ${scene.sceneId}  duration=${scene.durationMs}ms  words=${scene.words.length}  ${scene.audioPath}`,
  );
}

const scriptOutPath = path.join(outDir, "script.with-durations.json");
await writeFile(scriptOutPath, JSON.stringify(result.script, null, 2));
console.log(`\nUpdated script (real durations) written to ${scriptOutPath}`);
