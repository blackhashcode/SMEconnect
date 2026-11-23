import type { NextRequest } from "next/server";
import { parsePagination } from "@/lib/pagination";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest, ok } from "@/server/http/response";
import { createReview, listReviews } from "@/server/services/reviews";
import {
  createReviewSchema,
  reviewListQuerySchema,
} from "@/server/validators/social";

/** Public reviews for one profile. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const query = reviewListQuerySchema.parse({
      userId: searchParams.get("userId"),
    });
    const result = await listReviews({ ...pagination, ...query });
    return ok(result.items, result.meta);
  });
}

/** OWNER/INVESTOR only; the reviewer is always the session user. */
export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const input = createReviewSchema.parse(await request.json());
    return created(await createReview(session.user as Actor, input));
  });
}
