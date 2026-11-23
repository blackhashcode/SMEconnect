import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, ok } from "@/server/http/response";
import { listFeed } from "@/server/services/post";
import { feedQuerySchema } from "@/server/validators/social";

/** Personalized feed: own posts, followed authors, connections + OPEN loan requests. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const filters = feedQuerySchema.parse(
      Object.fromEntries(
        [...searchParams.entries()].filter(
          ([key]) => key !== "cursor" && key !== "limit",
        ),
      ),
    );
    const result = await listFeed(session.user as Actor, { ...pagination, ...filters });
    return ok(result.items, result.meta);
  });
}
