import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { markConversationRead } from "@/server/services/messaging";
import { idSchema } from "@/server/validators/common";
import { clearMessageNotifications } from "@/server/services/notify";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id } = await params;
    const conversationId = idSchema.parse(id);
    const result = await markConversationRead(session.user as Actor, conversationId);
    // Reading the chat also clears its "new message" notification.
    await clearMessageNotifications(session.user.id, conversationId);
    return ok(result);
  });
}
