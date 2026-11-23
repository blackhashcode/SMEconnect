import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { getOwnerDashboard } from "@/server/services/dashboards";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER");
    return ok(await getOwnerDashboard(actor));
  });
}
