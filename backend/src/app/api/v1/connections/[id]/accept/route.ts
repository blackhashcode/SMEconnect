import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { notifyUser } from "@/server/services/notify";
import { handleRequest, ok } from "@/server/http/response";
import { acceptConnection } from "@/server/services/connection";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PENDING → ACCEPTED; only the addressee may act. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id: rawId } = await params;
    const result = await acceptConnection(session.user as Actor, idSchema.parse(rawId));
    const name = session.user.name;
    await notifyUser({ userId: result.userId, type: "CONNECTION_ACCEPTED", title: `You're now connected with ${name}`, body: `${name} accepted your connection request.`, link: "/connections", data: { connectionId: result.id, fromUserId: session.user.id } });
    return ok(result);
  });
}
