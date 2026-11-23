import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { likePost, unlikePost } from "@/server/services/post";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id: rawId } = await params;
    return ok(await likePost(session.user as Actor, idSchema.parse(rawId)));
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id: rawId } = await params;
    return ok(await unlikePost(session.user as Actor, idSchema.parse(rawId)));
  });
}
