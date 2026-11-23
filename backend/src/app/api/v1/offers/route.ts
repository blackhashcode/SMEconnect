import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { createOffer } from "@/server/services/offers";
import { createOfferSchema } from "@/server/validators/offer";

/** INVESTOR submits an offer; identity and expiry come from the session/server. */
export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("INVESTOR");
    const input = createOfferSchema.parse(await request.json());
    const result = await createOffer(session.user as Actor, input);
    await recordAudit({ actorId: session.user.id, action: "offer.created", targetType: "OFFER", targetId: (result as { id?: string }).id ?? null, detail: { loanRequestId: input.loanRequestId }, ipAddress: clientIp(request.headers) });
    return created(result);
  });
}
