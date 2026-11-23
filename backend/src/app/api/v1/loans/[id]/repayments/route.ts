import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { listRepaymentsForLoan } from "@/server/services/repayments";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor();
    const { id } = await context.params;
    return ok(await listRepaymentsForLoan(actor, id));
  });
}
