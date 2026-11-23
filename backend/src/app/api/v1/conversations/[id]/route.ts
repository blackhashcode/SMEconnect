import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getConversation } from "@/server/services/messaging";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id } = await params;
    return ok(await getConversation(session.user as Actor, idSchema.parse(id)));
  });
}
