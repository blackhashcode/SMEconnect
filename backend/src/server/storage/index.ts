import { AppError } from "@/server/errors";
import { localStorageProvider } from "@/server/storage/providers/local";
import type { StorageProvider } from "@/server/storage/types";

/** Storage is selected by env so a cloud provider can be added without touching callers. */
export function getStorageProvider(): StorageProvider {
  const configured = process.env.STORAGE_PROVIDER?.trim() || "local";

  if (configured !== "local") {
    throw new AppError(
      "STORAGE_CONFIG_ERROR",
      "Unsupported storage provider",
      500,
    );
  }

  return localStorageProvider;
}

export type {
  FileVisibility,
  SaveFileInput,
  StorageProvider,
  StoredFile,
  StoredFileContent,
} from "@/server/storage/types";
