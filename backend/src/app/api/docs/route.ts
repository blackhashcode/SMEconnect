import { NextResponse } from "next/server";
import { isApiDocsEnabled } from "@/server/openapi/config";
import { generateOpenApiDocument } from "@/server/openapi/document";
import { NotFoundError } from "@/server/errors";
import { fail } from "@/server/http/response";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isApiDocsEnabled()) {
    return fail(new NotFoundError());
  }

  const document = generateOpenApiDocument({ serverUrl: request.url });

  return NextResponse.json(document, {
    headers: { "Cache-Control": "no-store" },
  });
}
