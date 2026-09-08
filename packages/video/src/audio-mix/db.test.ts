import { describe, it, expect } from "vitest";
import { dbToAmplitude } from "./db.js";

describe("dbToAmplitude", () => {
  it("0dB is unity gain", () => {
    expect(dbToAmplitude(0)).toBeCloseTo(1);
  });

  it("-6dB is roughly half amplitude", () => {
    expect(dbToAmplitude(-6)).toBeCloseTo(0.501, 2);
  });

  it("-1dB is close to (but below) unity, for the true-peak ceiling", () => {
    const v = dbToAmplitude(-1);
    expect(v).toBeLessThan(1);
    expect(v).toBeGreaterThan(0.85);
  });
});
