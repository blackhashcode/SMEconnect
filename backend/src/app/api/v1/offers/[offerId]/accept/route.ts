import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { acceptOffer } from "@/server/services/offers";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ offerId: string }>;
}

/** Counterparty accepts; the service runs the atomic loan/agreement creation flow. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { offerId } = await params;
    const result = await acceptOffer(session.user as Actor, idSchema.parse(offerId));
    await recordAudit({ actorId: session.user.id, action: "offer.accepted", targetType: "OFFER", targetId: offerId, detail: null, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
