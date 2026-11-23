import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { markAllNotificationsRead } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export async function POST() {
  return handleRequest(async () => {
    const actor = await requireActor();
    return ok(await markAllNotificationsRead(actor));
  });
}
