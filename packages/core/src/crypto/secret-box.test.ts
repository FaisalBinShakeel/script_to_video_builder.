import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptSecret, decryptSecret, SecretBoxError } from "./secret-box.js";

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext secret", () => {
    const encrypted = encryptSecret("sk-super-secret-key", KEY);
    expect(decryptSecret(encrypted, KEY)).toBe("sk-super-secret-key");
  });

  it("never stores the plaintext in the ciphertext", () => {
    const encrypted = encryptSecret("sk-super-secret-key", KEY);
    expect(encrypted).not.toContain("sk-super-secret-key");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-value", KEY);
    const b = encryptSecret("same-value", KEY);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong master key", () => {
    const encrypted = encryptSecret("sk-super-secret-key", KEY);
    expect(() => decryptSecret(encrypted, OTHER_KEY)).toThrow(SecretBoxError);
  });

  it("fails to decrypt tampered ciphertext", () => {
    const encrypted = encryptSecret("sk-super-secret-key", KEY);
    const buf = Buffer.from(encrypted, "base64");
    buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff;
    expect(() => decryptSecret(buf.toString("base64"), KEY)).toThrow(SecretBoxError);
  });

  it("rejects a master key of the wrong length", () => {
    expect(() => encryptSecret("value", Buffer.from("too-short").toString("base64"))).toThrow(
      SecretBoxError,
    );
  });
});
