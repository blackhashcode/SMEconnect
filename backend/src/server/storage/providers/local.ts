import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/server/errors";
import { EXTENSION_TO_MIME, validateUpload } from "@/server/storage/validation";
import { fileIdSchema } from "@/server/validators/storage";
import type {
  StorageProvider,
  StoredFile,
  StoredFileContent,
} from "@/server/storage/types";


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

    const extension = id.slice(id.lastIndexOf(".") + 1);
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

export { MAX_UPLOAD_BYTES } from "@/server/storage/validation";
