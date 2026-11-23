import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { dismissAdminReport } from "@/server/services/admin-reports";
import { idSchema } from "@/server/validators/common";
import { dismissReportSchema } from "@/server/validators/admin";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { reportId } = await params;
    const input = dismissReportSchema.parse(await request.json());
    return ok(
      await dismissAdminReport(
        session.user as Actor,
        idSchema.parse(reportId),
        input,
      ),
    );
  });
}
