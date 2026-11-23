import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/guards";
import { ValidationError } from "@/server/errors";
import { created, handleRequest } from "@/server/http/response";
import { enforceRateLimit } from "@/server/rate-limit";
import { assertUploadRequestSize, saveUploadedFile } from "@/server/storage/upload";
import { uploadPurposeSchema } from "@/server/validators/storage";

/**
 * Multipart upload: `purpose` + `file`. Visibility comes from the purpose
 * (ID documents and sales proofs are private), the real file type is checked
 * from its contents, and the client filename is ignored.
 */
export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireSession();
    await enforceRateLimit("upload:create", session.user.id);
    // Reject oversized bodies before buffering them.
    assertUploadRequestSize(request);

    const form = await request.formData().catch(() => {
      throw new ValidationError("Send the file as multipart/form-data");
    });
    const purpose = uploadPurposeSchema.parse(form.get("purpose"));
    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("Attach a file in the `file` field");

    return created(await saveUploadedFile({ file, purpose }));
  });
}
