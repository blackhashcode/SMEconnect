import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { deleteComment, updateComment } from "@/server/services/post";
import { idSchema } from "@/server/validators/common";
import { updateCommentSchema } from "@/server/validators/social";

interface RouteContext {
  params: Promise<{ id: string; commentId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id: rawId, commentId: rawCommentId } = await params;
    const input = updateCommentSchema.parse(await request.json());
    return ok(
      await updateComment(
        session.user as Actor,
        idSchema.parse(rawId),
        idSchema.parse(rawCommentId),
        input,
      ),
    );
  });
}

/** Soft delete; only the comment author may remove their own comment. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id: rawId, commentId: rawCommentId } = await params;
    return ok(
      await deleteComment(
        session.user as Actor,
        idSchema.parse(rawId),
        idSchema.parse(rawCommentId),
      ),
    );
  });
}
