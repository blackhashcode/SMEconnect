import { AppError } from "@/server/errors";
import { databaseStorageProvider } from "@/server/storage/providers/database";
import { localStorageProvider } from "@/server/storage/providers/local";
import type { StorageProvider } from "@/server/storage/types";

export { MAX_UPLOAD_BYTES } from "@/server/storage/validation";

/**
 * Storage is selected by env so callers never change:
 * - `local`: files on disk under UPLOAD_DIR (development)
 * - `database`: bytes in Postgres (serverless hosting with no writable disk)
 */
export function getStorageProvider(): StorageProvider {
  const configured = process.env.STORAGE_PROVIDER?.trim() || "local";

  if (configured === "local") return localStorageProvider;
  if (configured === "database") return databaseStorageProvider;

  throw new AppError("STORAGE_CONFIG_ERROR", "Unsupported storage provider", 500);
}

export type {
  FileVisibility,
  SaveFileInput,
  StorageProvider,
  StoredFile,
  StoredFileContent,
} from "@/server/storage/types";
