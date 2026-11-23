import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, ok } from "@/server/http/response";
import { suggestBusinesses } from "@/server/services/discovery";

/** INVESTOR-only matches based on the investor's own profile preferences. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("INVESTOR");
    const result = await suggestBusinesses(
      session.user as Actor,
      parsePagination(request.nextUrl.searchParams),
    );
    return ok(result.items, result.meta);
  });
}
