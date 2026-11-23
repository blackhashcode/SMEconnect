import type { NextRequest } from "next/server";
import { parsePagination } from "@/lib/pagination";
import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { listInvestors } from "@/server/services/profiles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    await requireActor();
    const sp = request.nextUrl.searchParams;
    const page = parsePagination(sp);
    const verifiedParam = sp.get("verified");
    const result = await listInvestors(
      {
        q: sp.get("q") ?? undefined,
        location: sp.get("location") ?? undefined,
        verified: verifiedParam === null ? undefined : verifiedParam === "true",
      },
      page,
    );
    return ok(result.items, result.meta);
  });
}
