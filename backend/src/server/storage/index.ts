import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ValidationError } from "@/server/errors";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export interface StoredFile {
  key: string;
  contentType: string;
  sizeBytes: number;
  visibility: "public" | "private";
}

export interface StorageProvider {
  save(input: {
    buffer: Buffer;
    contentType: string;
    visibility: "public" | "private";
  }): Promise<StoredFile>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/**
 * Local disk storage provider (stores files outside `public/`).
 * Swap with Cloudinary/S3 implementation via STORAGE_PROVIDER env var in production.
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly rootDir: string;

  constructor(rootDir = process.env.UPLOAD_DIR ?? "./uploads") {
    this.rootDir = path.resolve(rootDir);
  }

  async save(input: {
    buffer: Buffer;
    contentType: string;
    visibility: "public" | "private";
  }): Promise<StoredFile> {
    const ext = ALLOWED_MIME_TO_EXT[input.contentType];
    if (!ext) {
      throw new ValidationError("Only JPEG, PNG, WebP images and PDF files are allowed");
    }
    if (input.buffer.byteLength === 0 || input.buffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new ValidationError("File size must be between 1 byte and 5 MB");
    }

    const fileName = `${crypto.randomUUID()}${ext}`;
    const key = `${input.visibility}/${fileName}`;
    const fullPath = this.resolveSafe(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);

    return {
      key,
      contentType: input.contentType,
      sizeBytes: input.buffer.byteLength,
      visibility: input.visibility,
    };
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveSafe(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolveSafe(key), { force: true });
  }

  private resolveSafe(key: string): string {
    const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const resolved = path.resolve(this.rootDir, normalized);
    if (!resolved.startsWith(this.rootDir + path.sep)) {
      throw new ValidationError("Invalid storage key");
    }
    return resolved;
  }
}

export const storageProvider: StorageProvider = new LocalStorageProvider();
