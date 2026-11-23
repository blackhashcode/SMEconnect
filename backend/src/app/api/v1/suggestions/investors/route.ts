import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, ok } from "@/server/http/response";
import { suggestInvestors } from "@/server/services/discovery";

/** OWNER-only matches based on the owner's business profile and OPEN request. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER");
    const result = await suggestInvestors(
      session.user as Actor,
      parsePagination(request.nextUrl.searchParams),
    );
    return ok(result.items, result.meta);
  });
}
