import { describe, expect, it } from "vitest";
import {
  MAX_BDT,
  bdtAmountSchema,
  emailSchema,
  isoDateTimeSchema,
  longTextSchema,
  normalizeRatePct,
  optionalTextSchema,
  positiveBdtSchema,
  ratePctSchema,
  shortTextSchema,
  urlSchema,
} from "@/server/validators/common";

describe("BDT validators", () => {
  it("accepts whole-taka amounts within the Int range", () => {
    expect(bdtAmountSchema.parse(0)).toBe(0);
    expect(bdtAmountSchema.parse(150_000)).toBe(150_000);
    expect(bdtAmountSchema.parse(MAX_BDT)).toBe(MAX_BDT);
  });

  it.each([-1, 1.5, MAX_BDT + 1, Number.NaN])(
    "rejects invalid BDT amount %s",
    (value) => {
      expect(bdtAmountSchema.safeParse(value).success).toBe(false);
    },
  );

  it("requires positive amounts where specified", () => {
    expect(positiveBdtSchema.safeParse(0).success).toBe(false);
    expect(positiveBdtSchema.parse(1)).toBe(1);
  });
});

describe("ratePctSchema", () => {
  it.each([
    [0, "0.00"],
    [14, "14.00"],
    [14.5, "14.50"],
    ["14.57", "14.57"],
    [100, "100.00"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(ratePctSchema.parse(input)).toBe(expected);
  });

  it.each([-1, 100.01, 14.567, "14.567", "abc", ""]) (
    "rejects invalid rate %s",
    (input) => {
      expect(ratePctSchema.safeParse(input).success).toBe(false);
    },
  );

  it("normalizes decimal strings to two places", () => {
    expect(normalizeRatePct("7")).toBe("7.00");
    expect(normalizeRatePct("7.5")).toBe("7.50");
  });
});

describe("sanitized text validators", () => {
  it("strips markup and control characters before storing text", () => {
    expect(shortTextSchema.parse("  <b>Nusrat's</b> Kitchen  ")).toBe("Nusrat's Kitchen");
    expect(longTextSchema.parse("Line 1\r\n<script>alert(1)</script>\n\n\nLine 2")).toBe(
      "Line 1\n\nLine 2",
    );
  });

  it("rejects text that is only markup", () => {
    expect(shortTextSchema.safeParse("<p></p>").success).toBe(false);
    expect(longTextSchema.safeParse("<script>x</script>").success).toBe(false);
  });

  it("allows intentionally empty optional text", () => {
    expect(optionalTextSchema.parse("<b></b>")).toBe("");
    expect(optionalTextSchema.parse(undefined)).toBeUndefined();
  });
});

describe("format validators", () => {
  it("validates emails", () => {
    expect(emailSchema.safeParse("owner@example.com").success).toBe(true);
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("validates URLs", () => {
    expect(urlSchema.safeParse("https://example.com/a").success).toBe(true);
    expect(urlSchema.safeParse("ftp://example.com").success).toBe(false);
  });

  it("validates ISO 8601 UTC datetimes", () => {
    expect(isoDateTimeSchema.safeParse("2026-11-23T10:00:00.000Z").success).toBe(
      true,
    );
    expect(isoDateTimeSchema.safeParse("23-11-2026").success).toBe(false);
  });
});
