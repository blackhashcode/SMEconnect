import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter, RateLimitError } from "@/server/rate-limit";

describe("InMemoryRateLimiter", () => {
  it("allows up to maxRequests and throws RateLimitError thereafter", () => {
    const limiter = new InMemoryRateLimiter({ windowMs: 10_000, maxRequests: 2 });
    expect(limiter.check("k1", 1000).remaining).toBe(1);
    expect(limiter.check("k1", 2000).remaining).toBe(0);
    expect(() => limiter.check("k1", 3000)).toThrow(RateLimitError);
  });

  it("resets after the window elapses", () => {
    const limiter = new InMemoryRateLimiter({ windowMs: 5_000, maxRequests: 1 });
    limiter.check("k1", 1000);
    expect(() => limiter.check("k1", 2000)).toThrow(RateLimitError);
    expect(limiter.check("k1", 7000).remaining).toBe(0);
  });

  it("evicts stale/oldest keys when maxEntries is reached", () => {
    const limiter = new InMemoryRateLimiter({ windowMs: 60_000, maxRequests: 2, maxEntries: 2 });
    limiter.check("a", 1000);
    limiter.check("b", 1000);
    limiter.check("c", 1000); // evicts "a"
    expect(limiter.check("a", 1000).remaining).toBe(1);
  });
});
