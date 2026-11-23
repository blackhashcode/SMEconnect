import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { unfollowUser } from "@/server/services/follow";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { userId: rawUserId } = await params;
    return ok(await unfollowUser(session.user as Actor, idSchema.parse(rawUserId)));
  });
}
