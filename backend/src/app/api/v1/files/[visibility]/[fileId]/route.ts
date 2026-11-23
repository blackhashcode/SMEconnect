import { NextResponse, type NextRequest } from "next/server";
import type { Actor } from "@/server/auth/policy";
import { requireSession } from "@/server/auth/guards";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { handleRequest } from "@/server/http/response";
import { canAccessPrivateFile } from "@/server/storage/authorization";
import { getStorageProvider } from "@/server/storage";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { fileIdSchema, fileVisibilitySchema } from "@/server/validators/storage";

interface RouteContext {
  params: Promise<{ visibility: string; fileId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const { visibility: rawVisibility, fileId: rawFileId } = await params;
    const visibility = fileVisibilitySchema.parse(rawVisibility);
    const fileId = fileIdSchema.parse(rawFileId);

    // Authorize before touching storage so unauthenticated/foreign private
    // requests cannot probe the filesystem at all.
    let viewer: Actor | null = null;
    if (visibility === "private") {
      const session = await requireSession();
      viewer = session.user as Actor;
      const url = `/api/v1/files/private/${fileId}`;
      const allowed = await canAccessPrivateFile(url, viewer);
      if (!allowed) throw new ForbiddenError("You do not own this file");
    }

    const file = await getStorageProvider().read(visibility, fileId);
    if (!file) throw new NotFoundError("File not found");

    // Every time an admin opens someone's private document, it goes in the activity log.
    if (viewer?.role === "ADMIN") {
      await recordAudit({ actorId: viewer.id, action: "admin.document_viewed", targetType: "FILE", targetId: fileId, detail: { contentType: file.contentType }, ipAddress: clientIp(request.headers) });
    }

    const isPdf = file.contentType === "application/pdf";
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
        // Shown in the browser, not downloaded. Safe because uploads are only
        // JPEG/PNG/WebP/PDF verified by their magic bytes (never HTML or SVG),
        // and the CSP below stops the response from running anything.
        "Content-Disposition": `inline; filename="${visibility === "private" ? "document" : "image"}.${file.contentType.split("/")[1] ?? "bin"}"`,
        "Content-Security-Policy": isPdf
          ? "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'"
          : "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  });
}
