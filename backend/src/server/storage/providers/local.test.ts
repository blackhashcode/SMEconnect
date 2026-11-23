import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  localStorageProvider,
  MAX_UPLOAD_BYTES,
} from "@/server/storage/providers/local";

const TEMP_ROOT = "/tmp/opencode";
let uploadDir: string;

beforeEach(async () => {
  await mkdir(TEMP_ROOT, { recursive: true });
  uploadDir = await mkdtemp(path.join(TEMP_ROOT, "sme-storage-"));
  vi.stubEnv("UPLOAD_DIR", uploadDir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(uploadDir, { recursive: true, force: true });
});

describe("local storage provider", () => {
  it("stores private files outside public with a randomized id", async () => {
    const data = Buffer.from("%PDF-1.4 test document");
    const stored = await localStorageProvider.save({
      data,
      contentType: "application/pdf",
      visibility: "private",
    });

    expect(stored.id).toMatch(
      /^[0-9a-f-]{36}\.pdf$/,
    );
    expect(stored.url).toBe(`/api/v1/files/private/${stored.id}`);
    expect(stored.size).toBe(data.length);

    const filePath = path.join(uploadDir, "private", stored.id);
    await expect(readFile(filePath)).resolves.toEqual(data);
    await expect(
      stat(path.join(process.cwd(), "public", stored.id)),
    ).rejects.toThrow();
  });

  it("reads back stored content using the derived content type", async () => {
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const stored = await localStorageProvider.save({
      data,
      contentType: "image/png",
      visibility: "public",
    });

    await expect(
      localStorageProvider.read("public", stored.id),
    ).resolves.toEqual({ data, contentType: "image/png" });
  });

  it("rejects files larger than 5 MB", async () => {
    await expect(
      localStorageProvider.save({
        data: Buffer.alloc(MAX_UPLOAD_BYTES + 1),
        contentType: "application/pdf",
        visibility: "private",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects unsupported MIME types", async () => {
    await expect(
      localStorageProvider.save({
        data: Buffer.from("MZ executable"),
        contentType: "application/x-msdownload",
        visibility: "public",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects files whose contents don't match the declared type", async () => {
    await expect(
      localStorageProvider.save({
        data: Buffer.from("<html><script>alert(1)</script></html>"),
        contentType: "image/png",
        visibility: "public",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("never resolves traversal paths", async () => {
    await expect(
      localStorageProvider.read("private", "../../etc/passwd"),
    ).resolves.toBeNull();
    await expect(
      localStorageProvider.read("public", "missing.jpg"),
    ).resolves.toBeNull();
  });

  it("refuses to write inside the public directory", async () => {
    vi.stubEnv("UPLOAD_DIR", "./public/uploads");

    await expect(
      localStorageProvider.save({
        data: Buffer.from("%PDF-1.4 test"),
        contentType: "application/pdf",
        visibility: "private",
      }),
    ).rejects.toMatchObject({
      code: "STORAGE_CONFIG_ERROR",
      message: "UPLOAD_DIR must be outside the public directory",
    });
  });
});
