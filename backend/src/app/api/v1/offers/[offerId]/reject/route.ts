import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { rejectOffer } from "@/server/services/offers";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ offerId: string }>;
}

/** Counterparty rejects a pending offer. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { offerId } = await params;
    return ok(await rejectOffer(session.user as Actor, idSchema.parse(offerId)));
  });
}
