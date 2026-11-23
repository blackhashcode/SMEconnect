import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isApiDocsEnabled } from "@/server/openapi/config";
import { generateOpenApiDocument } from "@/server/openapi/document";
import SwaggerUIClient from "./SwaggerUIClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SME Connect API documentation",
};

function firstHeaderValue(value: string | null): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

export default async function DocsPage() {
  if (!isApiDocsEnabled()) {
    notFound();
  }

  const requestHeaders = await headers();
  const host =
    firstHeaderValue(requestHeaders.get("x-forwarded-host")) ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const forwardedProtocol = firstHeaderValue(
    requestHeaders.get("x-forwarded-proto"),
  );
  const protocol = forwardedProtocol === "https" ? "https" : "http";
  const spec = generateOpenApiDocument({ serverUrl: `${protocol}://${host}` });

  return (
    <main style={{ padding: "1rem" }}>
      {/* Served from the pinned local Swagger UI package, not an app stylesheet import. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/docs/assets/swagger-ui.css" />
      <SwaggerUIClient spec={spec} />
    </main>
  );
}
