import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { updateLoanRequestStatus } from "@/server/services/loans";
import { updateLoanStatusSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER", "ADMIN");
    const { id } = await context.params;
    const { status } = updateLoanStatusSchema.parse(await request.json());
    return ok(await updateLoanRequestStatus(actor, id, status));
  });
}
