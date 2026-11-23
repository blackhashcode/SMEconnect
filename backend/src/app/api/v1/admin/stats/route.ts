import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getAdminStats } from "@/server/services/admin-analytics";

export async function GET() {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    return ok(await getAdminStats(session.user as Actor));
  });
}
