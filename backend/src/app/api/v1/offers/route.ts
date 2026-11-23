import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest } from "@/server/http/response";
import { createOffer } from "@/server/services/offers";
import { createOfferSchema } from "@/server/validators/offer";

/** INVESTOR submits an offer; identity and expiry come from the session/server. */
export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("INVESTOR");
    const input = createOfferSchema.parse(await request.json());
    return created(await createOffer(session.user as Actor, input));
  });
}
