import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { resolveAdminReport } from "@/server/services/admin-reports";
import { idSchema } from "@/server/validators/common";
import { resolveReportSchema } from "@/server/validators/admin";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { reportId } = await params;
    const input = resolveReportSchema.parse(await request.json());
    return ok(
      await resolveAdminReport(
        session.user as Actor,
        idSchema.parse(reportId),
        input,
      ),
    );
  });
}
