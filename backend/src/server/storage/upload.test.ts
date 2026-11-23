import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/server/errors";
import { MAX_UPLOAD_BYTES } from "@/server/storage";
import {
  assertUploadRequestSize,
  MAX_UPLOAD_REQUEST_BYTES,
  saveUploadedFile,
} from "@/server/storage/upload";
import type { StorageProvider, StoredFile } from "@/server/storage/types";

const stored: StoredFile = {
  id: "00000000-0000-4000-8000-000000000001.jpg",
  visibility: "public",
  contentType: "image/jpeg",
  size: 1,
  url: "/api/v1/files/public/00000000-0000-4000-8000-000000000001.jpg",
};

function fakeProvider() {
  const save = vi.fn(async (): Promise<StoredFile> => stored);
  const provider: StorageProvider = {
    save,
    read: async () => null,
  };
  return { provider, save };
}

function requestWithLength(length: string): Request {
  return { headers: new Headers({ "content-length": length }) } as Request;
}

describe("upload size hardening", () => {
  it("rejects an oversized request before buffering its body", () => {
    expect(() =>
      assertUploadRequestSize(requestWithLength(String(MAX_UPLOAD_REQUEST_BYTES + 1))),
    ).toThrowError(ValidationError);
    expect(() =>
      assertUploadRequestSize(requestWithLength(String(MAX_UPLOAD_REQUEST_BYTES))),
    ).not.toThrow();
    expect(() => assertUploadRequestSize({ headers: new Headers() } as Request)).not.toThrow();
  });

  it("rejects empty and oversized files before calling the storage provider", async () => {
    const { provider, save } = fakeProvider();
    const empty = new File([], "empty.jpg", { type: "image/jpeg" });
    const oversized = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "large.jpg", {
      type: "image/jpeg",
    });

    await expect(
      saveUploadedFile({ file: empty, purpose: "AVATAR" }, { provider }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      saveUploadedFile({ file: oversized, purpose: "AVATAR" }, { provider }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(save).not.toHaveBeenCalled();
  });

  it("still saves valid files through the provider", async () => {
    const { provider, save } = fakeProvider();
    const file = new File([new Uint8Array([1])], "valid.jpg", { type: "image/jpeg" });

    await expect(
      saveUploadedFile({ file, purpose: "AVATAR" }, { provider }),
    ).resolves.toEqual(stored);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/jpeg",
        visibility: "public",
      }),
    );
  });
});
