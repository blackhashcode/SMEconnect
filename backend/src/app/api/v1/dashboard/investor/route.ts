import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getInvestorDashboard } from "@/server/services/dashboards";

/** INVESTOR-only aggregate dashboard; all metrics are server-derived. */
export async function GET() {
  return handleRequest(async () => {
    const session = await requireRole("INVESTOR");
    return ok(await getInvestorDashboard(session.user as Actor));
  });
}
