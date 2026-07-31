import { describe, expect, it } from "vitest";
import {
  MAX_WORKERS_PBKDF2_ITERATIONS,
  hashPassword,
  passwordProblem,
  sha256Hex,
  verifyPassword,
} from "./password.server";

/**
 * The iteration cap is the whole point of this file.
 *
 * Workers rejects PBKDF2 above 100,000 iterations, but the local emulator
 * accepts any value — so a too-high count passes every local check and then
 * breaks signup, the demo and every login the moment it is deployed. Nothing
 * else in the suite can catch that, so it is asserted directly.
 */
describe("the Workers PBKDF2 iteration cap", () => {
  it("never exceeds what the runtime supports", async () => {
    expect(MAX_WORKERS_PBKDF2_ITERATIONS).toBeLessThanOrEqual(100_000);

    const hash = await hashPassword("a quiet morning");
    const iterations = Number(hash.split("$")[1]);
    expect(iterations).toBeLessThanOrEqual(100_000);
  });

  it("still uses an iteration count worth having", () => {
    expect(MAX_WORKERS_PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(100_000);
  });
});

describe("hashing", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("come back to the breath");
    expect(await verifyPassword("come back to the breath", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("come back to the breath");
    expect(await verifyPassword("come back to the bread", hash)).toBe(false);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same password", a)).toBe(true);
    expect(await verifyPassword("same password", b)).toBe(true);
  });

  it("stores the iteration count with the hash so it can be raised later", async () => {
    const hash = await hashPassword("x".repeat(12));
    const [scheme, iterations, salt, digest] = hash.split("$");
    expect(scheme).toBe("pbkdf2");
    expect(Number(iterations)).toBe(MAX_WORKERS_PBKDF2_ITERATIONS);
    expect(salt).toBeTruthy();
    expect(digest).toBeTruthy();
  });

  it("treats missing or malformed stored hashes as a miss, not a crash", async () => {
    for (const stored of [
      null,
      undefined,
      "",
      "not-a-hash",
      "pbkdf2$only$three",
      "bcrypt$100000$aaaa$bbbb",
      "pbkdf2$10$aaaa$bbbb", // implausibly low iteration count
      "pbkdf2$100000$!!!not-base64!!!$bbbb",
    ]) {
      expect(await verifyPassword("anything", stored), String(stored)).toBe(
        false,
      );
    }
  });
});

describe("password rules", () => {
  it("asks for length rather than character classes", () => {
    expect(passwordProblem("short")).toMatch(/at least 10 characters/);
    expect(passwordProblem("a quiet morning")).toBeNull();
    // No complexity requirement — length is what actually matters.
    expect(passwordProblem("aaaaaaaaaaaa")).toBeNull();
  });

  it("refuses something longer than we can store", () => {
    expect(passwordProblem("x".repeat(500))).toMatch(/under 200 characters/);
  });
});

describe("sha256Hex", () => {
  it("is stable and hex-encoded", async () => {
    const a = await sha256Hex("token");
    expect(a).toBe(await sha256Hex("token"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(await sha256Hex("token2"));
  });
});
