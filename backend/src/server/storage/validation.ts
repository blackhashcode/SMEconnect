import { ValidationError } from "@/server/errors";
import type { SaveFileInput } from "@/server/storage/types";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export type AllowedMime = keyof typeof MIME_TO_EXTENSION;

export const EXTENSION_TO_MIME = Object.fromEntries(
  Object.entries(MIME_TO_EXTENSION).map(([mime, extension]) => [extension, mime]),
) as Record<string, AllowedMime>;

const startsWith = (data: Buffer, bytes: number[], offset = 0) =>
  data.length >= offset + bytes.length && bytes.every((byte, i) => data[offset + i] === byte);

/**
 * Identifies the real file type from its leading "magic" bytes. The browser's
 * declared Content-Type is user-controlled, so it is never trusted on its own:
 * an HTML page renamed to avatar.png must not be stored or served as an image.
 */
export function detectContentType(data: Buffer): AllowedMime | null {
  if (startsWith(data, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (startsWith(data, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  return null;
}

/** Shared by every storage provider; returns the file extension to store under. */
export function validateUpload({ data, contentType, visibility }: SaveFileInput) {
  if (visibility !== "public" && visibility !== "private") {
    throw new ValidationError("Invalid file visibility");
  }
  if (data.length === 0 || data.length > MAX_UPLOAD_BYTES) {
    throw new ValidationError(`File size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`);
  }

  const extension = MIME_TO_EXTENSION[contentType as AllowedMime];
  if (!extension) {
    throw new ValidationError("Only JPEG, PNG, WebP and PDF files are allowed");
  }
  if (detectContentType(data) !== contentType) {
    throw new ValidationError("File contents do not match the declared file type");
  }

  return extension;
}
