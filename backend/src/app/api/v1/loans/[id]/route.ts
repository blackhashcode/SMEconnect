import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { getLoanRequestById } from "@/server/services/loans";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor();
    const { id } = await context.params;
    return ok(await getLoanRequestById(actor, id));
  });
}
