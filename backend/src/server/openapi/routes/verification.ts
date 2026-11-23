import "@/server/openapi/setup";
import { z } from "zod";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  STANDARD_ERROR_RESPONSES,
  adminVerificationDetailSuccessEnvelopeSchema,
  verificationListSuccessEnvelopeSchema,
  verificationStatusSuccessEnvelopeSchema,
  verificationSuccessEnvelopeSchema,
} from "@/server/openapi/schemas";

export const VERIFICATION_PATH = "/api/v1/verifications";
export const MY_VERIFICATION_PATH = `${VERIFICATION_PATH}/me`;
export const ADMIN_VERIFICATIONS_PATH = "/api/v1/admin/verifications";
export const ADMIN_VERIFICATION_REVIEW_PATH = `${ADMIN_VERIFICATIONS_PATH}/{id}`;

export const VERIFICATION_PATHS = [
  VERIFICATION_PATH,
  MY_VERIFICATION_PATH,
  ADMIN_VERIFICATIONS_PATH,
  ADMIN_VERIFICATION_REVIEW_PATH,
] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];

function jsonSchemaRef(name: string) {
  return {
    "application/json": {
      schema: { $ref: `#/components/schemas/${name}` },
    },
  };
}

function jsonResponse(schema: z.ZodType, example: unknown) {
  return {
    "application/json": { schema, example },
  };
}

export function registerVerificationRoutes() {
  registry.registerPath({
    method: "post",
    path: VERIFICATION_PATH,
    operationId: "submitVerification",
    tags: ["Verification"],
    summary: "Submit or resubmit owner/investor verification",
    description:
      "Upload private documents first and pass the returned internal URLs. A rejected verification can be resubmitted; pending and approved ones cannot.",
    security: sessionSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("SubmitVerificationRequest"),
    },
    responses: {
      201: {
        description: "Verification submitted for review",
        content: jsonResponse(verificationSuccessEnvelopeSchema, {
          data: {
            id: "ver_123",
            type: "OWNER",
            status: "PENDING",
            idDocumentUrl:
              "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
            salesProofUrls: [
              "/api/v1/files/private/3a9d2b65-7c8e-4d0f-8a12-1b2c3d4e5f60.jpg",
            ],
            shopLinks: ["https://www.facebook.com/shop/example"],
            reviewNote: null,
            submittedAt: "2026-11-23T18:00:00.000Z",
            reviewedAt: null,
          },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      409: STANDARD_ERROR_RESPONSES[409],
    },
  });

  registry.registerPath({
    method: "get",
    path: MY_VERIFICATION_PATH,
    operationId: "getMyVerification",
    tags: ["Verification"],
    summary: "Get the current user's verification",
    description:
      "Returns the verification matching the authenticated user's role, or `null` when none has been submitted.",
    security: sessionSecurity,
    responses: {
      200: {
        description: "Current verification status",
        content: jsonResponse(verificationStatusSuccessEnvelopeSchema, {
          data: null,
        }),
      },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "get",
    path: ADMIN_VERIFICATIONS_PATH,
    operationId: "listVerifications",
    tags: ["Administration"],
    summary: "List verifications for admin review",
    description:
      "ADMIN only. Cursor-paginated queue, newest submissions first. A verification-result notification is created when a decision is made.",
    security: sessionSecurity,
    parameters: [
      {
        name: "status",
        in: "query",
        required: false,
        schema: { $ref: "#/components/schemas/VerificationStatus" },
      },
      {
        name: "cursor",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Opaque cursor returned by the previous page",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: MAX_PAGE_LIMIT,
          default: DEFAULT_PAGE_LIMIT,
        },
      },
    ],
    responses: {
      200: {
        description: "Page of verification submissions",
        content: jsonResponse(verificationListSuccessEnvelopeSchema, {
          data: [],
          meta: { limit: DEFAULT_PAGE_LIMIT, nextCursor: null, hasMore: false },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "get",
    path: ADMIN_VERIFICATION_REVIEW_PATH,
    operationId: "getVerificationForAdmin",
    tags: ["Administration"],
    summary: "Get one verification submission for admin review",
    description:
      "ADMIN only. Returns private verification documents and the submitter/reviewer identifiers.",
    security: sessionSecurity,
    parameters: [{ $ref: "#/components/parameters/IdPathParam" }],
    responses: {
      200: {
        description: "Verification submission detail",
        content: jsonResponse(adminVerificationDetailSuccessEnvelopeSchema, {
          data: {
            id: "ver_123",
            userId: "usr_123",
            reviewerId: null,
            type: "OWNER",
            status: "PENDING",
            idDocumentUrl:
              "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
            salesProofUrls: [
              "/api/v1/files/private/3a9d2b65-7c8e-4d0f-8a12-1b2c3d4e5f60.jpg",
            ],
            shopLinks: ["https://www.facebook.com/shop/example"],
            reviewNote: null,
            submittedAt: "2026-11-23T18:00:00.000Z",
            reviewedAt: null,
          },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "post",
    path: ADMIN_VERIFICATION_REVIEW_PATH,
    operationId: "reviewVerification",
    tags: ["Administration"],
    summary: "Approve or reject a pending verification",
    description:
      "ADMIN only. Rejections require a review note. The decision and in-app notification are written in one transaction.",
    security: sessionSecurity,
    parameters: [{ $ref: "#/components/parameters/IdPathParam" }],
    requestBody: {
      required: true,
      content: jsonSchemaRef("ReviewVerificationRequest"),
    },
    responses: {
      200: {
        description: "Reviewed verification",
        content: jsonResponse(verificationSuccessEnvelopeSchema, {
          data: {
            id: "ver_123",
            type: "OWNER",
            status: "APPROVED",
            idDocumentUrl:
              "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
            salesProofUrls: [
              "/api/v1/files/private/3a9d2b65-7c8e-4d0f-8a12-1b2c3d4e5f60.jpg",
            ],
            shopLinks: [],
            reviewNote: null,
            submittedAt: "2026-11-23T18:00:00.000Z",
            reviewedAt: "2026-11-23T19:00:00.000Z",
          },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
    },
  });
}
