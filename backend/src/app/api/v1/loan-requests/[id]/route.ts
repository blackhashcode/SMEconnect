import { handleRequest, ok } from "@/server/http/response";
import { getPublicLoanRequest } from "@/server/services/loan-request";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Public detail of an OPEN request; other statuses return 404. */
export async function GET(_request: Request, { params }: RouteContext) {
  return handleRequest(async () => {
    const { id: rawId } = await params;
    return ok(await getPublicLoanRequest(idSchema.parse(rawId)));
  });
}
