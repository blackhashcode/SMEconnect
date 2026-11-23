import type { NextRequest } from "next/server";
import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { listOffersForUser } from "@/server/services/offers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const actor = await requireActor();
    const role = request.nextUrl.searchParams.get("role");
    const roleFilter = role === "sent" || role === "received" ? role : undefined;
    return ok(await listOffersForUser(actor, roleFilter));
  });
}
