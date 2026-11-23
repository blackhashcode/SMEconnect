import { requireActor } from "@/server/auth/guards";
import { created, handleRequest } from "@/server/http/response";
import { writeRateLimiter } from "@/server/rate-limit";
import { createOffer } from "@/server/services/offers";
import { createOfferSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    const actor = await requireActor("INVESTOR");
    writeRateLimiter.check(`offer:${actor.id}`);
    const { id } = await context.params;
    const body = createOfferSchema.parse(await request.json());
    return created(await createOffer(actor, id, body));
  });
}
