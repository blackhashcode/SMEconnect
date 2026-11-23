import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { writeRateLimiter } from "@/server/rate-limit";
import { respondToOffer } from "@/server/services/offers";
import { respondOfferSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER", "INVESTOR");
    writeRateLimiter.check(`offer-respond:${actor.id}`);
    const { id } = await context.params;
    const body = respondOfferSchema.parse(await request.json());
    return ok(await respondToOffer(actor, id, body));
  });
}
