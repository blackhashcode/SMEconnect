import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { confirmAgreement } from "@/server/services/agreements";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER", "INVESTOR");
    const { id } = await context.params;
    return ok(await confirmAgreement(actor, id));
  });
}
