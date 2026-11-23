import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { getAdminStats } from "@/server/services/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRequest(async () => {
    const actor = await requireActor("ADMIN");
    return ok(await getAdminStats(actor));
  });
}
