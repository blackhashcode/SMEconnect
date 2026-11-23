import { NextResponse, type NextRequest } from "next/server";
import type { Actor } from "@/server/auth/policy";
import { requireSession } from "@/server/auth/guards";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { handleRequest } from "@/server/http/response";
import { canAccessPrivateFile } from "@/server/storage/authorization";
import { getStorageProvider } from "@/server/storage";
import { fileIdSchema, fileVisibilitySchema } from "@/server/validators/storage";

interface RouteContext {
  params: Promise<{ visibility: string; fileId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const { visibility: rawVisibility, fileId: rawFileId } = await params;
    const visibility = fileVisibilitySchema.parse(rawVisibility);
    const fileId = fileIdSchema.parse(rawFileId);

    const file = await getStorageProvider().read(visibility, fileId);
    if (!file) throw new NotFoundError("File not found");

    if (visibility === "private") {
      const session = await requireSession();
      const url = `/api/v1/files/private/${fileId}`;
      const allowed = await canAccessPrivateFile(url, session.user as Actor);
      if (!allowed) throw new ForbiddenError("You do not own this file");
    }

    return new NextResponse(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.data.length),
        "Cache-Control":
          visibility === "public"
            ? "public, max-age=31536000, immutable"
            : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(visibility === "private"
          ? { "Content-Disposition": 'attachment; filename="document"' }
          : {}),
      },
    });
  });
}
