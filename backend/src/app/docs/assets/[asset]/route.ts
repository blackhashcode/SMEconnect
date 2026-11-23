import { readFile } from "node:fs/promises";
import path from "node:path";

const ASSET_FILES = {
  "swagger-ui.css": "swagger-ui.css",
  "swagger-ui-bundle.js": "swagger-ui-bundle.js",
} as const;

type SwaggerAsset = keyof typeof ASSET_FILES;

const assetDirectory = path.join(
  process.cwd(),
  "node_modules",
  "swagger-ui-react",
);
const assetCache = new Map<SwaggerAsset, Uint8Array<ArrayBuffer>>();

async function readAsset(asset: SwaggerAsset): Promise<Uint8Array<ArrayBuffer>> {
  const cached = assetCache.get(asset);
  if (cached) return cached;

  const contents = await readFile(
    path.join(assetDirectory, ASSET_FILES[asset]),
  );
  const body: Uint8Array<ArrayBuffer> = new Uint8Array(contents);
  assetCache.set(asset, body);
  return body;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;

  if (!Object.hasOwn(ASSET_FILES, asset)) {
    return new Response("Not found", { status: 404 });
  }

  const name = asset as SwaggerAsset;
  const body = await readAsset(name);
  const contentType =
    name === "swagger-ui.css" ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8";

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(body.byteLength),
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
