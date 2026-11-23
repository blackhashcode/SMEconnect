import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getOwnerDashboard } from "@/server/services/dashboards";

/** OWNER-only aggregate dashboard; all metrics are server-derived. */
export async function GET() {
  return handleRequest(async () => {
    const session = await requireRole("OWNER");
    return ok(await getOwnerDashboard(session.user as Actor));
  });
}
