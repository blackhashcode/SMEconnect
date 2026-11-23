import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest } from "@/server/http/response";
import { followUser } from "@/server/services/follow";
import { followUserSchema } from "@/server/validators/social";

export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const input = followUserSchema.parse(await request.json());
    return created(await followUser(session.user as Actor, input));
  });
}
