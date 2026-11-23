import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/profile";

describe("safeNextPath — open redirect protection", () => {
  it("allows valid relative app paths with query strings", () => {
    expect(safeNextPath("/feed")).toBe("/feed");
    expect(safeNextPath("/messages?thread=th-1")).toBe("/messages?thread=th-1");
  });

  it("blocks protocol-relative URLs, external origins, backslashes, and control characters", () => {
    expect(safeNextPath("//evil.com")).toBe("/feed");
    expect(safeNextPath("https://evil.com/phish")).toBe("/feed");
    expect(safeNextPath("/\\evil.com")).toBe("/feed");
    expect(safeNextPath("/\t/evil.com")).toBe("/feed");
    expect(safeNextPath("")).toBe("/feed");
    expect(safeNextPath(undefined)).toBe("/feed");
  });
});
