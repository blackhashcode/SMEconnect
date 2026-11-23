import { handleRequest, okPublic } from "@/server/http/response";
import { getPublicProfile } from "@/server/services/profile";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/** Public, sanitized profile lookup. No session or ownership check is required. */
export async function GET(_request: Request, { params }: RouteContext) {
  return handleRequest(async () => {
    const { userId: rawUserId } = await params;
    const userId = idSchema.parse(rawUserId);
    return okPublic(await getPublicProfile(userId));
  });
}
