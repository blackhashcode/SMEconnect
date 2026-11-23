import "@/server/openapi/setup";
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { API_DOC_INFO, API_TAGS, resolveServerUrl } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import { registerApiRoutes } from "@/server/openapi/routes";
import "@/server/openapi/schemas";

export interface GenerateOpenApiDocumentOptions {
  /** Full request URL; its origin is used as the OpenAPI server URL. */
  serverUrl?: string;
}

/** Builds the OpenAPI 3.1 document from the shared Zod schemas and registry. */
export function generateOpenApiDocument(
  options: GenerateOpenApiDocumentOptions = {},
) {
  registerApiRoutes();

  const serverUrl = resolveServerUrl(options.serverUrl);

  return new OpenApiGeneratorV31(registry.definitions, {
    sortComponents: "alphabetically",
  }).generateDocument({
    openapi: "3.1.0",
    info: { ...API_DOC_INFO },
    tags: API_TAGS.map((tag) => ({ ...tag })),
    ...(serverUrl ? { servers: [{ url: serverUrl }] } : {}),
  });
}
