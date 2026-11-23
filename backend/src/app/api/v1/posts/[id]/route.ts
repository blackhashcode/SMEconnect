import type { NextRequest } from "next/server";
import { getSession, requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
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
    const session = await requireRole("OWNER", "INVESTOR");
    const { id: rawId } = await params;
    const input = updatePostSchema.parse(await request.json());
    return ok(await updatePost(session.user as Actor, idSchema.parse(rawId), input));
  });
}

/** Soft delete; system-generated loan/repayment posts are protected. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id: rawId } = await params;
    return ok(await deletePost(session.user as Actor, idSchema.parse(rawId)));
  });
}
