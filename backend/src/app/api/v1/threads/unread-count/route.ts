import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { getUnreadMessageCount } from "@/server/services/messages";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRequest(async () => {
    const actor = await requireActor();
    return ok({ unread: await getUnreadMessageCount(actor) });
  });
}
