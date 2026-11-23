import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest } from "@/server/http/response";
import { counterOffer } from "@/server/services/offers";
import { idSchema } from "@/server/validators/common";
import { counterOfferSchema } from "@/server/validators/offer";

interface RouteContext {
  params: Promise<{ offerId: string }>;
}

/** Counterparty proposes a linked replacement offer. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { offerId } = await params;
    const input = counterOfferSchema.parse(await request.json());
    return created(await counterOffer(session.user as Actor, idSchema.parse(offerId), input));
  });
}
