import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError, ValidationError } from "@/server/errors";
import { fileIdSchema } from "@/server/validators/storage";
import type {
  SaveFileInput,
  StorageProvider,
  StoredFile,
  StoredFileContent,
} from "@/server/storage/types";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

const EXTENSION_TO_MIME = Object.fromEntries(
  Object.entries(MIME_TO_EXTENSION).map(([mime, extension]) => [extension, mime]),
) as Record<string, string>;

type AllowedExtension = keyof typeof EXTENSION_TO_MIME;

function uploadRoot(): string {
  const configured = process.env.UPLOAD_DIR?.trim() || "./uploads";
  const root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
  const publicRoot = path.resolve(process.cwd(), "public");

  if (root === publicRoot || root.startsWith(`${publicRoot}${path.sep}`)) {
    throw new AppError(
      "STORAGE_CONFIG_ERROR",
      "UPLOAD_DIR must be outside the public directory",
      500,
    );
  }

  return root;
}

function validateUpload({ data, contentType, visibility }: SaveFileInput) {
  if (visibility !== "public" && visibility !== "private") {
    throw new ValidationError("Invalid file visibility");
  }
  if (data.length === 0 || data.length > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `File size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`,
    );
  }

  const extension = MIME_TO_EXTENSION[contentType as keyof typeof MIME_TO_EXTENSION];
  if (!extension) {
    throw new ValidationError(
      "Only JPEG, PNG, WebP and PDF files are allowed",
    );
  }

  return extension;
}

export const localStorageProvider: StorageProvider = {
  async save(input): Promise<StoredFile> {
    const extension = validateUpload(input);
    const id = `${randomUUID()}.${extension}`;
    const directory = path.join(/*turbopackIgnore: true*/ uploadRoot(), input.visibility);

    await mkdir(directory, { recursive: true });
    await writeFile(path.join(/*turbopackIgnore: true*/ directory, id), input.data, { flag: "wx" });

    return {
      id,
      visibility: input.visibility,
      contentType: input.contentType,
      size: input.data.length,
      url: `/api/v1/files/${input.visibility}/${id}`,
    };
  },

  async read(visibility, id): Promise<StoredFileContent | null> {
    if (!fileIdSchema.safeParse(id).success) return null;

    const extension = id.slice(id.lastIndexOf(".") + 1) as AllowedExtension;
    const contentType = EXTENSION_TO_MIME[extension];
    if (!contentType) return null;

    try {
      const data = await readFile(
        path.join(/*turbopackIgnore: true*/ uploadRoot(), visibility, id),
      );
      return { data, contentType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
};
