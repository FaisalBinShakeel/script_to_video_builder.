import { describe, it, expect, vi, beforeEach } from "vitest";

const requestStructuredCompletion = vi.fn();
const getModelChain = vi.fn();

vi.mock("../llm/openrouter.js", () => ({
  requestStructuredCompletion: (...args: unknown[]) =>
    requestStructuredCompletion(...args),
  getModelChain: () => getModelChain(),
}));

const { generateScript, ScriptGenerationError } = await import("./script.js");

function validScriptJson(overrides: Partial<Record<string, unknown>> = {}) {
  return JSON.stringify({
    title: "5 Benefits of Green Tea",
    language: "en",
    tone: "energetic",
    musicMood: "upbeat",
    scenes: [
      {
        id: 1,
        narration: "Green tea is a metabolism booster you're sleeping on.",
        onScreenText: "Wake up your metabolism",
        searchKeywords: ["steaming cup green tea", "person drinking tea morning"],
        duration: 5,
        emphasis: "hook",
      },
      {
        id: 2,
        narration: "It's packed with antioxidants that fight cell damage.",
        onScreenText: "Loaded with antioxidants",
        searchKeywords: ["green tea leaves closeup", "person pouring tea"],
        duration: 5,
        emphasis: "normal",
      },
      {
        id: 3,
        narration: "Try one cup a day and feel the difference yourself.",
        onScreenText: "Start today",
        searchKeywords: ["person holding tea cup smiling", "tea cup on table"],
        duration: 5,
        emphasis: "cta",
      },
    ],
    estimatedDuration: 15,
    ...overrides,
  });
}

beforeEach(() => {
  requestStructuredCompletion.mockReset();
  getModelChain.mockReset();
  getModelChain.mockReturnValue(["primary/model"]);
});

describe("generateScript", () => {
  const input = {
    topic: "5 benefits of green tea",
    tone: "energetic" as const,
    language: "en" as const,
    targetDuration: 15 as const,
    format: "portrait" as const,
  };

  it("returns a validated script on a valid first response", async () => {
    requestStructuredCompletion.mockResolvedValueOnce({
      raw: validScriptJson(),
      provider: "anthropic",
    });

    const script = await generateScript(input);

    expect(script.title).toBe("5 Benefits of Green Tea");
    expect(script.scenes).toHaveLength(3);
    expect(script.scenes[0]?.emphasis).toBe("hook");
    expect(script.scenes.at(-1)?.emphasis).toBe("cta");
    expect(requestStructuredCompletion).toHaveBeenCalledTimes(1);
  });

  it("retries once on malformed JSON and succeeds", async () => {
    requestStructuredCompletion
      .mockResolvedValueOnce({ raw: "not json{{{", provider: "openai" })
      .mockResolvedValueOnce({ raw: validScriptJson(), provider: "openai" });

    const script = await generateScript(input);

    expect(script.scenes).toHaveLength(3);
    expect(requestStructuredCompletion).toHaveBeenCalledTimes(2);
    // The retry must feed the validation error back into the prompt.
    const secondCallArgs = requestStructuredCompletion.mock.calls[1]?.[0] as {
      messages: { role: string; content: string }[];
    };
    expect(
      secondCallArgs.messages.some(
        (m) => m.role === "user" && m.content.includes("failed schema validation"),
      ),
    ).toBe(true);
  });

  it("retries once on a schema violation and succeeds", async () => {
    // Only 1 scene: violates the min(3) constraint.
    requestStructuredCompletion
      .mockResolvedValueOnce({
        raw: validScriptJson({
          scenes: [
            {
              id: 1,
              narration: "Too short",
              onScreenText: "Nope",
              searchKeywords: ["a", "b"],
              duration: 5,
              emphasis: "hook",
            },
          ],
        }),
        provider: "openai",
      })
      .mockResolvedValueOnce({ raw: validScriptJson(), provider: "openai" });

    const script = await generateScript(input);

    expect(script.scenes).toHaveLength(3);
    expect(requestStructuredCompletion).toHaveBeenCalledTimes(2);
  });

  it("fails loudly after exhausting the single retry", async () => {
    requestStructuredCompletion
      .mockResolvedValueOnce({ raw: "still not json", provider: "openai" })
      .mockResolvedValueOnce({ raw: "still not json either", provider: "openai" });

    await expect(generateScript(input)).rejects.toThrow(ScriptGenerationError);
    expect(requestStructuredCompletion).toHaveBeenCalledTimes(2);
  });

  it("does not fall back to another model after a validation failure", async () => {
    getModelChain.mockReturnValue(["primary/model", "fallback/model"]);
    requestStructuredCompletion
      .mockResolvedValueOnce({ raw: "bad", provider: "openai" })
      .mockResolvedValueOnce({ raw: "still bad", provider: "openai" });

    await expect(generateScript(input)).rejects.toThrow(ScriptGenerationError);
    // Only the primary model was ever called; the fallback model must not
    // be tried after a validation failure (only after a request error).
    expect(requestStructuredCompletion).toHaveBeenCalledTimes(2);
    const models = requestStructuredCompletion.mock.calls.map(
      (c) => (c[0] as { model: string }).model,
    );
    expect(models).toEqual(["primary/model", "primary/model"]);
  });

  it("falls back to the next model when a request throws", async () => {
    getModelChain.mockReturnValue(["primary/model", "fallback/model"]);
    requestStructuredCompletion
      .mockRejectedValueOnce(new Error("503 from primary/model"))
      .mockResolvedValueOnce({ raw: validScriptJson(), provider: "openai" });

    const script = await generateScript(input);

    expect(script.scenes).toHaveLength(3);
    const models = requestStructuredCompletion.mock.calls.map(
      (c) => (c[0] as { model: string }).model,
    );
    expect(models).toEqual(["primary/model", "fallback/model"]);
  });
});
