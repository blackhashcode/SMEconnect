import { parsePagination } from "@/lib/pagination";
import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest, ok } from "@/server/http/response";
import { enforceRateLimit } from "@/server/rate-limit";
import { listMessages, sendMessage } from "@/server/services/messaging";
import { idSchema } from "@/server/validators/common";
import {
  messageListQuerySchema,
  sendMessageSchema,
} from "@/server/validators/message";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const query = messageListQuerySchema.parse(
      Object.fromEntries(
        [...searchParams.entries()].filter(
          ([key]) => key !== "cursor" && key !== "limit",
        ),
      ),
    );
    const result = await listMessages(session.user as Actor, idSchema.parse(id), {
      ...pagination,
      ...query,
    });
    return ok(result.items, result.meta);
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id } = await params;
    await enforceRateLimit("message:send", session.user.id);
    const input = sendMessageSchema.parse(await request.json());
    return created(await sendMessage(session.user as Actor, idSchema.parse(id), input));
  });
}
