import "@/server/openapi/setup";
import { registry } from "@/server/openapi/registry";
import {
  healthSuccessEnvelopeSchema,
  STANDARD_ERROR_RESPONSES,
} from "@/server/openapi/schemas";

export const HEALTH_PATH = "/api/v1/health";
export const HEALTH_OPERATION_ID = "getHealth";

export function registerHealthRoute() {
  registry.registerPath({
    method: "get",
    path: HEALTH_PATH,
    operationId: HEALTH_OPERATION_ID,
    tags: ["Health"],
    summary: "Check API and database connectivity",
    description:
      "Returns service status and PostgreSQL connectivity. No authentication required.",
    security: [],
    responses: {
      200: {
        description: "API and PostgreSQL are reachable",
        content: {
          "application/json": {
            schema: healthSuccessEnvelopeSchema,
            example: {
              data: {
                status: "ok",
                database: "connected",
                timestamp: "2026-11-23T18:00:00.000Z",
              },
            },
          },
        },
      },
      503: STANDARD_ERROR_RESPONSES[503],
    },
  });
}
