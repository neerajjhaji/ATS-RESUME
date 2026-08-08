import { describe, it, expect } from "vitest";
import { withRetry, isTransient } from "@/lib/retry";

describe("isTransient", () => {
  it("treats 429 and 5xx as transient, other 4xx as not", () => {
    expect(isTransient({ status: 429 })).toBe(true);
    expect(isTransient({ status: 503 })).toBe(true);
    expect(isTransient({ status: 400 })).toBe(false);
    expect(isTransient({ status: 404 })).toBe(false);
    expect(isTransient(new Error("network"))).toBe(true); // unknown => transient
  });
});

describe("withRetry", () => {
  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw { status: 503 };
        return "ok";
      },
      { retries: 3, baseMs: 1 }
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry non-transient (4xx) errors", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw { status: 400 };
        },
        { retries: 3, baseMs: 1 }
      )
    ).rejects.toBeDefined();
    expect(calls).toBe(1);
  });
});
