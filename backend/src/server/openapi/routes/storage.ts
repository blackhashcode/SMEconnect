import "@/server/openapi/setup";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  STANDARD_ERROR_RESPONSES,
  uploadedFileSuccessEnvelopeSchema,
} from "@/server/openapi/schemas";

export const UPLOAD_PATH = "/api/v1/uploads";
export const FILE_PATH = "/api/v1/files/{visibility}/{fileId}";
export const STORAGE_PATHS = [UPLOAD_PATH, FILE_PATH] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];

export function registerStorageRoutes() {
  registry.registerPath({
    method: "post",
    path: UPLOAD_PATH,
    operationId: "uploadFile",
    tags: ["Verification"],
    summary: "Upload a verification or public image file",
    description:
      "Multipart upload with a `file` and a `purpose`. Visibility is derived from purpose: ID_DOCUMENT/SALES_PROOF are private; AVATAR/COVER/PRODUCT_IMAGE are public. Maximum 5 MB; JPEG, PNG, WebP and PDF only.",
    security: sessionSecurity,
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["purpose", "file"],
            properties: {
              purpose: { $ref: "#/components/schemas/UploadPurpose" },
              file: {
                type: "string",
                format: "binary",
                description: "File payload; the original filename is ignored",
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: "File stored",
        content: {
          "application/json": {
            schema: uploadedFileSuccessEnvelopeSchema,
            example: {
              data: {
                id: "2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
                url: "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
                visibility: "private",
                contentType: "application/pdf",
                size: 20480,
              },
            },
          },
        },
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      500: STANDARD_ERROR_RESPONSES[500],
    },
  });

  registry.registerPath({
    method: "get",
    path: FILE_PATH,
    operationId: "getFile",
    tags: ["Verification"],
    summary: "Serve a stored file",
    description:
      "Public files need no session. Private files require an authenticated owner whose verification references the file, or an ADMIN session. Private files are never served from a public URL.",
    security: [{ [SECURITY_SCHEME_NAME]: [] }, {}],
    parameters: [
      {
        name: "visibility",
        in: "path",
        required: true,
        schema: { $ref: "#/components/schemas/FileVisibility" },
      },
      {
        name: "fileId",
        in: "path",
        required: true,
        schema: { $ref: "#/components/schemas/FileId" },
      },
    ],
    responses: {
      200: {
        description: "File bytes with the correct content type",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });
}
