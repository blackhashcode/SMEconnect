import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { markNotificationRead } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor();
    const { id } = await context.params;
    return ok(await markNotificationRead(actor, id));
  });
}
