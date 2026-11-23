import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { unblockUser } from "@/server/services/blocks";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/** Removes only the session user's own block. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { userId } = await params;
    return ok(await unblockUser(session.user as Actor, idSchema.parse(userId)));
  });
}
