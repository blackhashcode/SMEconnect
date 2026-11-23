import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { removeAdminComment } from "@/server/services/admin-moderation";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ commentId: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { commentId } = await params;
    return ok(
      await removeAdminComment(session.user as Actor, idSchema.parse(commentId)),
    );
  });
}
