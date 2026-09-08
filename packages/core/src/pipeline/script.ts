import {
  requestStructuredCompletion,
  getModelChain,
  type OpenRouterMessage,
} from "../llm/openrouter.js";
import {
  VideoScriptSchema,
  VIDEO_SCRIPT_JSON_SCHEMA,
  SCENE_COUNT_BY_DURATION,
  WORDS_PER_SECOND,
  ScriptGenerationInputSchema,
  type VideoScript,
  type ScriptGenerationInput,
} from "../schema/script.js";

export class ScriptGenerationError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ScriptGenerationError";
  }
}

function buildSystemPrompt(input: ScriptGenerationInput): string {
  const sceneCount = SCENE_COUNT_BY_DURATION[input.targetDuration];
  const wordBudget = Math.round(input.targetDuration * WORDS_PER_SECOND);

  return `You are a short-form social video scriptwriter. Given a topic, you
write a scene-by-scene breakdown for a ${input.targetDuration}-second video
in the "${input.tone}" tone, written in ${
    input.language === "ur" ? "Urdu" : "English"
  }.

Rules:
- Produce exactly ${sceneCount} scenes.
- Total narration across all scenes should read aloud in roughly
  ${input.targetDuration} seconds, i.e. about ${wordBudget} words total
  (${WORDS_PER_SECOND} words/second). Do not pad or rush individual scenes.
- Scene 1 MUST have emphasis "hook" and grab attention in the first line.
- The LAST scene MUST have emphasis "cta" (a call to action).
- Every other scene has emphasis "normal".
- onScreenText is at most 8 words: punchy, not a sentence.
- searchKeywords are the most important field for output quality. They are
  used verbatim to search stock-footage libraries, so they MUST be visually
  concrete nouns and actions, never abstract concepts.
  Good: "person typing laptop", "steaming cup green tea", "runner tying shoes"
  Bad: "productivity", "wellness", "success", "growth"
  Give 2-3 phrasing variants per scene so a search can fall back if the first
  finds nothing.
- estimatedDuration is the sum of every scene's duration estimate, in
  seconds.

Respond with ONLY the JSON object matching the provided schema. No prose,
no markdown fences.`;
}

function buildUserPrompt(input: ScriptGenerationInput): string {
  return `Topic: ${input.topic}\nFormat: ${input.format}\nMusic mood: pick whichever of upbeat/ambient/cinematic/corporate best fits the topic and tone.`;
}

interface AttemptResult {
  script: VideoScript;
  provider: string | undefined;
}

async function attemptOnModel(
  model: string,
  baseMessages: OpenRouterMessage[],
  apiKey: string | undefined,
): Promise<AttemptResult> {
  const messages = [...baseMessages];

  const first = await requestStructuredCompletion({
    model,
    messages,
    schemaName: "VideoScript",
    jsonSchema: VIDEO_SCRIPT_JSON_SCHEMA as Record<string, unknown>,
    apiKey,
  });

  const firstParsed = parseAndValidate(first.raw);
  if (firstParsed.success) {
    return { script: firstParsed.data, provider: first.provider };
  }

  // Retry once on the SAME model, feeding the validation error back into
  // the prompt so the model can correct itself.
  messages.push({ role: "assistant", content: first.raw });
  messages.push({
    role: "user",
    content: `Your last response failed schema validation with this error:\n${firstParsed.error}\n\nRespond again with ONLY a corrected JSON object matching the schema.`,
  });

  const second = await requestStructuredCompletion({
    model,
    messages,
    schemaName: "VideoScript",
    jsonSchema: VIDEO_SCRIPT_JSON_SCHEMA as Record<string, unknown>,
    apiKey,
  });

  const secondParsed = parseAndValidate(second.raw);
  if (secondParsed.success) {
    return { script: secondParsed.data, provider: second.provider };
  }

  // Fail loudly: do not silently fall back to another model on a
  // validation failure, that would mask a real schema/prompt problem.
  throw new ScriptGenerationError(
    `Model ${model} produced invalid script JSON twice. Last error: ${secondParsed.error}`,
  );
}

function parseAndValidate(
  raw: string,
):
  | { success: true; data: VideoScript }
  | { success: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return { success: false, error: `Malformed JSON: ${String(err)}` };
  }

  const result = VideoScriptSchema.safeParse(json);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  return { success: true, data: result.data };
}

export interface GenerateScriptOptions {
  /** Overrides OPENROUTER_API_KEY -- pass the calling user's own key when
   * they've set one under Settings > API Keys. */
  apiKey?: string;
}

/**
 * Generates a validated VideoScript for a topic. Tries each model in the
 * configured fallback chain in order; a model is only skipped in favor of
 * the next one when the REQUEST ITSELF fails (network/API error), never
 * because of a schema validation failure on that model (see attemptOnModel).
 */
export async function generateScript(
  rawInput: ScriptGenerationInput,
  options: GenerateScriptOptions = {},
): Promise<VideoScript> {
  const input = ScriptGenerationInputSchema.parse(rawInput);

  const messages: OpenRouterMessage[] = [
    { role: "system", content: buildSystemPrompt(input) },
    { role: "user", content: buildUserPrompt(input) },
  ];

  const models = getModelChain();
  const errors: string[] = [];

  for (const model of models) {
    try {
      const { script } = await attemptOnModel(model, messages, options.apiKey);
      // Always trust the audio pipeline over the LLM's duration estimate
      // later (phase 3), but recompute the sum here so it's at least
      // internally consistent with the scenes returned.
      const estimatedDuration = script.scenes.reduce(
        (sum, s) => sum + s.duration,
        0,
      );
      return { ...script, estimatedDuration };
    } catch (err) {
      if (err instanceof ScriptGenerationError) {
        // Schema failure on this model: per spec, fail loudly rather than
        // silently trying the next model.
        throw err;
      }
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new ScriptGenerationError(
    `All models in the fallback chain failed: ${errors.join(" | ")}`,
  );
}

export type { VideoScript, ScriptGenerationInput };
