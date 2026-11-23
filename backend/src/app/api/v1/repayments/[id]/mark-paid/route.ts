import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { markRepaymentPaid } from "@/server/services/repayments";
import { markRepaymentPaidSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER");
    const { id } = await context.params;
    const body = markRepaymentPaidSchema.parse(await request.json().catch(() => ({})));
    return ok(await markRepaymentPaid(actor, id, body));
  });
}
