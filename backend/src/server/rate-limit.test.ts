import { describe, expect, it } from "vitest";
import { RateLimitError } from "@/server/errors";
import {
  assertRateLimit,
  checkRateLimit,
  rateLimitRulesFromEnv,
  type RateLimitAction,
  type RateLimitRules,
} from "@/server/rate-limit";

const RULES: RateLimitRules = {
  "message:send": { limit: 2, windowMs: 1000 },
};

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

function clock(start = 0) {
  let current = start;
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe("rate limiting", () => {
  it("allows requests below the limit and reports remaining capacity", () => {
    const store = new Map<string, number[]>();
    const timer = clock();
    const options = { store, rules: RULES, now: timer.now };

    expect(checkRateLimit("message:send", "usr_1", options)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(checkRateLimit("message:send", "usr_1", options)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it.each(["message:send"] satisfies RateLimitAction[])(
    "blocks %s inside the window and recovers after it",
    (action) => {
      const store = new Map<string, number[]>();
      const timer = clock();
      const options = { store, rules: RULES, now: timer.now };

      checkRateLimit(action, "usr_1", options);
      checkRateLimit(action, "usr_1", options);
      const blocked = checkRateLimit(action, "usr_1", options);
      expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

      timer.advance(1001);
      expect(checkRateLimit(action, "usr_1", options).allowed).toBe(true);
    },
  );

  it("keeps separate counters for different users", () => {
    const store = new Map<string, number[]>();
    const timer = clock();
    const options = { store, rules: RULES, now: timer.now };

    checkRateLimit("message:send", "usr_1", options);
    checkRateLimit("message:send", "usr_1", options);

    expect(checkRateLimit("message:send", "usr_2", options).allowed).toBe(true);
  });

  it("throws a RateLimitError with retry details", () => {
    const store = new Map<string, number[]>();
    const timer = clock();
    const options = { store, rules: RULES, now: timer.now };

    assertRateLimit("message:send", "usr_1", options);
    assertRateLimit("message:send", "usr_1", options);

    expect(() => assertRateLimit("message:send", "usr_1", options)).toThrowError(
      expect.objectContaining({
        code: "RATE_LIMITED",
        details: expect.objectContaining({ retryAfterSeconds: expect.any(Number) }),
      }),
    );
    expect(RateLimitError).toBeDefined();
  });

  it("reads positive numeric limits from the environment", () => {
    expect(
      rateLimitRulesFromEnv(
        env({
          MESSAGE_RATE_LIMIT_MAX: "7",
          MESSAGE_RATE_LIMIT_WINDOW_SECONDS: "45",
        }),
      ),
    ).toEqual({ "message:send": { limit: 7, windowMs: 45_000 } });
    expect(rateLimitRulesFromEnv(env({ MESSAGE_RATE_LIMIT_MAX: "-1" }))).toEqual({
      "message:send": { limit: 30, windowMs: 60_000 },
    });
  });
});
