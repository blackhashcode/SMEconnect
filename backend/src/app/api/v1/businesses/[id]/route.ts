import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { getBusinessByIdOrSlug } from "@/server/services/profiles";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRequest(async () => {
    await requireActor();
    const { id } = await context.params;
    return ok(await getBusinessByIdOrSlug(id));
  });
}
