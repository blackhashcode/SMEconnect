import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { notifyUser } from "@/server/services/notify";
import { parsePagination } from "@/lib/pagination";
import { created, handleRequest, ok } from "@/server/http/response";
import { listConnections, sendConnectionRequest } from "@/server/services/connection";
import {
  connectionListQuerySchema,
  sendConnectionRequestSchema,
} from "@/server/validators/social";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const filters = connectionListQuerySchema.parse(
      Object.fromEntries(
        [...searchParams.entries()].filter(
          ([key]) => key !== "cursor" && key !== "limit",
        ),
      ),
    );
    const result = await listConnections(session.user as Actor, { ...pagination, ...filters });
    return ok(result.items, result.meta);
  });
}

export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const input = sendConnectionRequestSchema.parse(await request.json());
    const result = await sendConnectionRequest(session.user as Actor, input);
    const name = session.user.name;
    if (result.status === "PENDING" && result.direction === "outgoing") {
      await notifyUser({ userId: result.userId, type: "CONNECTION_REQUEST", title: `${name} wants to connect`, body: input.message?.trim() || `${name} sent you a connection request.`, link: "/connections", data: { connectionId: result.id, fromUserId: session.user.id } });
    } else if (result.status === "ACCEPTED") {
      await notifyUser({ userId: result.userId, type: "CONNECTION_ACCEPTED", title: `You're now connected with ${name}`, body: `${name} accepted your connection request.`, link: "/connections", data: { connectionId: result.id, fromUserId: session.user.id } });
    }
    return created(result);
  });
}
