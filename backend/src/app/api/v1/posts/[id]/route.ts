import type { NextRequest } from "next/server";
import { getSession, requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { deletePost, getPost, updatePost } from "@/server/services/post";
import { idSchema } from "@/server/validators/common";
import { updatePostSchema } from "@/server/validators/social";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Public post detail; anonymous callers see `likedByMe: false`. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await getSession();
    const { id: rawId } = await params;
    return ok(await getPost(idSchema.parse(rawId), session ? (session.user as Actor) : undefined));
  });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR", "ADMIN");
    const id = idSchema.parse((await params).id);
    const input = updatePostSchema.parse(await request.json());
    const result = await updatePost(session.user as Actor, id, input);
    if (session.user.role === "ADMIN") {
      await recordAudit({ actorId: session.user.id, action: "admin.post_edited", targetType: "POST", targetId: id, detail: null, ipAddress: clientIp(request.headers) });
    }
    return ok(result);
  });
}

/** Soft delete. Members can delete their own updates/milestones; admins can delete any post. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR", "ADMIN");
    const id = idSchema.parse((await params).id);
    const result = await deletePost(session.user as Actor, id);
    if (session.user.role === "ADMIN") {
      await recordAudit({ actorId: session.user.id, action: "admin.post_removed", targetType: "POST", targetId: id, detail: null, ipAddress: clientIp(request.headers) });
    }
    return ok(result);
  });
}
