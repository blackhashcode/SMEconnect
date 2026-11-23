import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { getInvestorDashboard } from "@/server/services/dashboards";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRequest(async () => {
    const actor = await requireActor("INVESTOR");
    return ok(await getInvestorDashboard(actor));
  });
}
