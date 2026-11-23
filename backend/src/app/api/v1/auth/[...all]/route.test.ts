import { beforeEach, describe, expect, it, vi } from "vitest";

const { handlerMock } = vi.hoisted(() => ({
  handlerMock: vi.fn(async () => new Response("ok")),
}));

vi.mock("@/server/auth", () => ({
  auth: { handler: handlerMock },
}));

import * as route from "./route";

beforeEach(() => {
  handlerMock.mockClear();
});

describe("Better Auth catch-all route", () => {
  it("delegates GET to the existing auth handler", async () => {
    const request = new Request("http://localhost/api/v1/auth/get-session");

    const response = await route.GET(request);

    expect(response.status).toBe(200);
    expect(handlerMock).toHaveBeenCalledOnce();
    expect(handlerMock).toHaveBeenCalledWith(request);
  });

  it("delegates POST to the existing auth handler", async () => {
    const request = new Request("http://localhost/api/v1/auth/sign-in/email", {
      method: "POST",
    });

    await route.POST(request);

    expect(handlerMock).toHaveBeenCalledOnce();
    expect(handlerMock).toHaveBeenCalledWith(request);
  });

  it("opts out of static rendering", () => {
    expect(route.dynamic).toBe("force-dynamic");
  });
});
