import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { reviewVerification } from "@/server/services/verifications";
import { reviewVerificationSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor("ADMIN");
    const { id } = await context.params;
    const body = reviewVerificationSchema.parse(await request.json());
    return ok(await reviewVerification(actor, id, body));
  });
}
