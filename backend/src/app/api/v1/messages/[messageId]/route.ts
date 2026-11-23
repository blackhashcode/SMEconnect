import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { deleteMessage, getMessage } from "@/server/services/messaging";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ messageId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { messageId } = await params;
    return ok(await getMessage(session.user as Actor, idSchema.parse(messageId)));
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { messageId } = await params;
    return ok(await deleteMessage(session.user as Actor, idSchema.parse(messageId)));
  });
}
