import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getOffer } from "@/server/services/offers";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ offerId: string }>;
}

/** Offer detail for either party only. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { offerId } = await params;
    return ok(await getOffer(session.user as Actor, idSchema.parse(offerId)));
  });
}
