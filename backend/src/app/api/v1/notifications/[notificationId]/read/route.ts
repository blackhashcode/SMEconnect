import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { markNotificationRead } from "@/server/services/notifications";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ notificationId: string }>;
}

/** Marks one of the session user's notifications as read (idempotent). */
export async function PATCH(_request: Request, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireSession();
    const { notificationId } = await params;
    return ok(
      await markNotificationRead(session.user as Actor, idSchema.parse(notificationId)),
    );
  });
}
