import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const request = (cookie?: string) =>
  new NextRequest("https://smeconnect.example/api/v1/me", { headers: cookie ? { cookie } : {} });

describe("API proxy pre-filter", () => {
  it("rejects a protected path with no session cookie", () => {
    expect(proxy(request()).status).toBe(401);
  });

  it("lets through the plain cookie used over http (local dev)", () => {
    expect(proxy(request("better-auth.session_token=abc.def")).status).toBe(200);
  });

  it("lets through the __Secure- cookie Better Auth sets over https (production)", () => {
    expect(proxy(request("__Secure-better-auth.session_token=abc.def")).status).toBe(200);
  });

  it("ignores unrelated cookies", () => {
    expect(proxy(request("theme=dark; session_token=abc")).status).toBe(401);
  });
});
