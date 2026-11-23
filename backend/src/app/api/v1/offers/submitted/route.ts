import { parsePagination } from "@/lib/pagination";
import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { listSubmittedOffers } from "@/server/services/offers";
import { offerListQuerySchema } from "@/server/validators/offer";

/** INVESTOR's own offers, cursor-paginated and optionally filtered by request id. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("INVESTOR");
    const params = new URLSearchParams(request.nextUrl.searchParams);
    params.delete("cursor");
    params.delete("limit");
    const filters = offerListQuerySchema.parse(Object.fromEntries(params));
    const result = await listSubmittedOffers(session.user as Actor, {
      ...parsePagination(request.nextUrl.searchParams),
      ...filters,
    });
    return ok(result.items, result.meta);
  });
}
