import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, ok } from "@/server/http/response";
import { listFollowers } from "@/server/services/follow";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const result = await listFollowers(
      session.user as Actor,
      parsePagination(request.nextUrl.searchParams),
    );
    return ok(result.items, result.meta);
  });
}
