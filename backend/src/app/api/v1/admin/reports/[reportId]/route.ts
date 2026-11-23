import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getAdminReport } from "@/server/services/admin-reports";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { reportId } = await params;
    return ok(await getAdminReport(session.user as Actor, idSchema.parse(reportId)));
  });
}
