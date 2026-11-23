import { handleRequest, ok } from "@/server/http/response";
import { getReview } from "@/server/services/reviews";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ reviewId: string }>;
}

/** Public review detail with safe participant cards only. */
export async function GET(_request: Request, { params }: RouteContext) {
  return handleRequest(async () => {
    const { reviewId } = await params;
    return ok(await getReview(idSchema.parse(reviewId)));
  });
}
