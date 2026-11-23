import { describe, expect, it } from "vitest";
import { GET } from "./route";

function context(asset: string) {
  return { params: Promise.resolve({ asset }) };
}

describe("Swagger UI asset route", () => {
  it("serves the pinned Swagger UI stylesheet from the local package", async () => {
    const response = await GET(new Request("http://localhost/docs/assets/swagger-ui.css"), context("swagger-ui.css"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(await response.text()).toContain(".swagger-ui");
  });

  it("serves the prebuilt bundle that avoids Turbopack ESM registration issues", async () => {
    const response = await GET(new Request("http://localhost/docs/assets/swagger-ui-bundle.js"), context("swagger-ui-bundle.js"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(await response.text()).toContain("SwaggerUIBundle");
  });

  it("rejects unknown assets instead of exposing arbitrary package files", async () => {
    const response = await GET(new Request("http://localhost/docs/assets/package.json"), context("package.json"));

    expect(response.status).toBe(404);
  });
});
