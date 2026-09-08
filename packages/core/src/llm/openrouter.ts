import OpenAI from "openai";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StructuredCompletionRequest {
  model: string;
  messages: OpenRouterMessage[];
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  /** Overrides OPENROUTER_API_KEY -- used when the calling user has set
   * their own key in Settings instead of the server's default. */
  apiKey?: string;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

/**
 * Constructs an OpenRouter client for `apiKey` (falling back to
 * OPENROUTER_API_KEY). Deliberately not cached as a singleton: different
 * callers now legitimately want different keys (a user's own key from
 * Settings vs. the server default), and constructing the OpenAI SDK client
 * is cheap.
 */
export function getOpenRouterClient(apiKey?: string): OpenAI {
  const key = apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new OpenRouterError(
      "No OpenRouter API key available. Set OPENROUTER_API_KEY in your .env, " +
        "or have the user add their own key under Settings > API Keys.",
    );
  }
  return new OpenAI({ apiKey: key, baseURL: "https://openrouter.ai/api/v1" });
}

/**
 * The model chain to try, in order: OPENROUTER_MODEL first, then each entry
 * in OPENROUTER_MODEL_FALLBACKS (comma-separated).
 */
export function getModelChain(): string[] {
  const primary = process.env.OPENROUTER_MODEL;
  if (!primary) {
    throw new OpenRouterError(
      "OPENROUTER_MODEL is not set. Add it to your .env file.",
    );
  }
  const fallbacks = (process.env.OPENROUTER_MODEL_FALLBACKS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [primary, ...fallbacks];
}

/**
 * A single structured-output request to OpenRouter. Callers own retry logic
 * (see packages/core/src/pipeline/script.ts) since a useful retry needs to
 * feed the Zod validation error back into the prompt, which this function
 * has no visibility into.
 *
 * Two things are non-negotiable here and must never be removed:
 *  - provider.require_parameters = true: without it OpenRouter will
 *    silently route to a provider that doesn't support json_schema and
 *    return malformed JSON instead of erroring.
 *  - response_format.json_schema.strict = true: enables OpenAI-style
 *    strict structured outputs where supported.
 */
export async function requestStructuredCompletion(
  req: StructuredCompletionRequest,
): Promise<{ raw: string; provider: string | undefined }> {
  const openai = getOpenRouterClient(req.apiKey);

  const completion = await openai.chat.completions.create({
    model: req.model,
    messages: req.messages,
    // @ts-expect-error -- OpenRouter-specific field not in the OpenAI SDK types.
    provider: { require_parameters: true },
    response_format: {
      type: "json_schema",
      json_schema: {
        name: req.schemaName,
        strict: true,
        schema: req.jsonSchema,
      },
    },
  });

  // OpenRouter echoes the provider that actually served the request in a
  // non-standard `provider` field on the response body. Log it so routing
  // changes (e.g. falling back to a cheaper/worse provider) are traceable.
  const provider = (completion as unknown as { provider?: string }).provider;
  console.log(
    `[openrouter] model=${req.model} provider=${provider ?? "unknown"}`,
  );

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new OpenRouterError(
      `OpenRouter returned no content for model ${req.model}`,
    );
  }
  return { raw, provider };
}
