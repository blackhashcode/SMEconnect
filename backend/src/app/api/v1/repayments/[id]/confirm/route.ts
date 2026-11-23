import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { confirmRepayment } from "@/server/services/repayments";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor("INVESTOR");
    const { id } = await context.params;
    return ok(await confirmRepayment(actor, id));
  });
}
