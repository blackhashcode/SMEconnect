import { requireActor } from "@/server/auth/guards";
import { created, handleRequest, ok } from "@/server/http/response";
import { listThreads, openOrReuseThread } from "@/server/services/messages";
import { openThreadSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRequest(async () => {
    const actor = await requireActor();
    const result = await listThreads(actor);
    return ok(result.threads, { unread: result.unread });
  });
}

export async function POST(request: Request) {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER", "INVESTOR");
    const body = openThreadSchema.parse(await request.json());
    const result = await openOrReuseThread(actor, body);
    return result.created ? created(result.thread) : ok(result.thread);
  });
}
