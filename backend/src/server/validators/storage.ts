import "@/server/openapi/setup";
import { z } from "zod";

/** Extensions are derived from MIME type, never from the client filename. */
export const FILE_EXTENSIONS = ["jpg", "png", "webp", "pdf"] as const;

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const FILE_ID_PATTERN = new RegExp(
  `^${UUID_PATTERN}\\.(?:${FILE_EXTENSIONS.join("|")})$`,
);

export const fileIdSchema = z
  .string()
  .regex(FILE_ID_PATTERN, "Invalid file identifier")
  .openapi({
    description: "Randomized storage filename including its derived extension",
    example: "2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
  });

export const fileVisibilitySchema = z.enum(["public", "private"]);

export const uploadPurposeSchema = z.enum([
  "ID_DOCUMENT",
  "SALES_PROOF",
  "AVATAR",
  "COVER",
  "PRODUCT_IMAGE",
]);

export const privateFileUrlSchema = z
  .string()
  .regex(
    new RegExp(`^/api/v1/files/private/${UUID_PATTERN}\\.(?:${FILE_EXTENSIONS.join("|")})$`),
    "Expected an internal private file URL returned by the upload endpoint",
  )
  .openapi({
    description: "Internal URL of a private file stored by the local storage provider",
    example: "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
  });

/** Only files uploaded with a public purpose may be referenced by public profiles. */
export const publicFileUrlSchema = z
  .string()
  .regex(
    new RegExp(`^/api/v1/files/public/${UUID_PATTERN}\\.(?:${FILE_EXTENSIONS.join("|")})$`),
    "Expected an internal public file URL returned by the upload endpoint",
  )
  .openapi({
    description: "Internal URL of a public file stored by the local storage provider",
    example: "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
  });

export const uploadedFileSchema = z
  .object({
    id: fileIdSchema,
    url: z.string().min(1),
    visibility: fileVisibilitySchema,
    contentType: z.string().min(1),
    size: z.number().int().positive(),
  })
  .strict();
