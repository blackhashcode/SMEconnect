import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getUnreadNotificationCount } from "@/server/services/notifications";

/** Cheap unread badge count for the session user. */
export async function GET() {
  return handleRequest(async () => {
    const session = await requireSession();
    return ok(await getUnreadNotificationCount(session.user as Actor));
  });
}
