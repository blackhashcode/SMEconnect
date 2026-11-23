import type { NextRequest } from "next/server";
import { requireActor } from "@/server/auth/guards";
import { created, handleRequest, ok } from "@/server/http/response";
import { listThreadMessages, sendThreadMessage } from "@/server/services/messages";
import { sendMessageSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor();
    const { id } = await context.params;
    const after = request.nextUrl.searchParams.get("after") ?? undefined;
    return ok(await listThreadMessages(actor, id, after));
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER", "INVESTOR");
    const { id } = await context.params;
    const { text } = sendMessageSchema.parse(await request.json());
    return created(await sendThreadMessage(actor, id, text));
  });
}
