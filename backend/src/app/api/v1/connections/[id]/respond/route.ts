import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { respondToConnection } from "@/server/services/connections";
import { respondConnectionSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER", "INVESTOR");
    const { id } = await context.params;
    const { decision } = respondConnectionSchema.parse(await request.json());
    return ok(await respondToConnection(actor, id, decision));
  });
}
