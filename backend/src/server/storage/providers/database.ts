import { randomUUID } from "node:crypto";
import { EXTENSION_TO_MIME, validateUpload } from "@/server/storage/validation";
import { fileIdSchema } from "@/server/validators/storage";
import type { StorageProvider, StoredFile, StoredFileContent } from "@/server/storage/types";

/**
 * Stores file bytes in Postgres. Serverless hosts (e.g. Vercel) have no durable
 * disk, and this keeps uploads working on a free tier without another service.
 * Files are capped at 5 MB by validateUpload; move to an object store (S3, R2)
 * behind the same interface once volume grows.
 */
// Imported lazily so selecting the local provider never requires a database.
const db = async () => (await import("@/server/db")).prisma;

export const databaseStorageProvider: StorageProvider = {
  async save(input): Promise<StoredFile> {
    const extension = validateUpload(input);
    const id = `${randomUUID()}.${extension}`;

    await (await db()).storedFile.create({
      data: {
        id,
        visibility: input.visibility,
        contentType: input.contentType,
        size: input.data.length,
        data: new Uint8Array(input.data),
      },
    });

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
    const expected = EXTENSION_TO_MIME[id.slice(id.lastIndexOf(".") + 1)];
    if (!expected) return null;

    const file = await (await db()).storedFile.findUnique({
      where: { id },
      select: { visibility: true, contentType: true, data: true },
    });
    // A public URL must never reveal a private file, and vice versa.
    if (!file || file.visibility !== visibility) return null;
    return { data: Buffer.from(file.data), contentType: file.contentType };
  },
};
