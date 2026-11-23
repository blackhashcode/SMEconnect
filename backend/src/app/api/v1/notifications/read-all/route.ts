import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { markAllNotificationsRead } from "@/server/services/notifications";

/** Marks every unread notification owned by the session user as read. */
export async function PATCH() {
  return handleRequest(async () => {
    const session = await requireSession();
    return ok(await markAllNotificationsRead(session.user as Actor));
  });
}
