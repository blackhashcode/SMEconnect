import { ValidationError } from "@/server/errors";
import { getStorageProvider, MAX_UPLOAD_BYTES } from "@/server/storage/index";
import type { FileVisibility, StorageProvider, StoredFile } from "@/server/storage/types";
import { uploadPurposeSchema } from "@/server/validators/storage";

/** Allow small multipart boundaries on top of the file-size limit. */
export const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

export function assertUploadRequestSize(request: Request): void {
  const header = request.headers.get("content-length");
  if (!header) return;
  const length = Number.parseInt(header, 10);
  if (Number.isSafeInteger(length) && length > MAX_UPLOAD_REQUEST_BYTES) {
    throw new ValidationError("Uploaded file must be between 1 byte and 5 MB");
  }
}

export type UploadPurpose =
  | "ID_DOCUMENT"
  | "SALES_PROOF"
  | "AVATAR"
  | "PRODUCT_IMAGE";

const PRIVATE_PURPOSES: ReadonlySet<UploadPurpose> = new Set([
  "ID_DOCUMENT",
  "SALES_PROOF",
]);

/** Visibility is derived from purpose; clients cannot opt into private/public freely. */
export function visibilityForPurpose(purpose: UploadPurpose): FileVisibility {
  uploadPurposeSchema.parse(purpose);
  return PRIVATE_PURPOSES.has(purpose) ? "private" : "public";
}

export interface SaveUploadedFileInput {
  file: File;
  purpose: UploadPurpose;
}

export interface SaveUploadedFileDependencies {
  provider?: StorageProvider;
}

export async function saveUploadedFile(
  { file, purpose }: SaveUploadedFileInput,
  deps: SaveUploadedFileDependencies = {},
): Promise<StoredFile> {
  const provider = deps.provider ?? getStorageProvider();

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new ValidationError("Uploaded file must be between 1 byte and 5 MB");
  }

  return provider.save({
    data: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
    visibility: visibilityForPurpose(purpose),
  });
}
