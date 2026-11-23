import { parsePagination } from "@/lib/pagination";
import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest, ok } from "@/server/http/response";
import { createOrGetConversation, listConversations } from "@/server/services/messaging";
import { createConversationSchema } from "@/server/validators/message";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const result = await listConversations(
      session.user as Actor,
      parsePagination(request.nextUrl.searchParams),
    );
    return ok(result.items, result.meta);
  });
}

export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const input = createConversationSchema.parse(await request.json());
    return created(await createOrGetConversation(session.user as Actor, input));
  });
}
