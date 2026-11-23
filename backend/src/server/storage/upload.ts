import { getStorageProvider } from "@/server/storage/index";
import type { FileVisibility, StorageProvider, StoredFile } from "@/server/storage/types";
import { uploadPurposeSchema } from "@/server/validators/storage";

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

  return provider.save({
    data: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
    visibility: visibilityForPurpose(purpose),
  });
}
