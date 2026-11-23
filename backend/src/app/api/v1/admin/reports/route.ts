import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, ok } from "@/server/http/response";
import { listReports } from "@/server/services/reports";
import { adminReportListQuerySchema } from "@/server/validators/admin";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const url = new URL(request.url);
    const query = adminReportListQuerySchema.parse({
      ...(url.searchParams.has("status")
        ? { status: url.searchParams.get("status") }
        : {}),
      ...(url.searchParams.has("targetType")
        ? { targetType: url.searchParams.get("targetType") }
        : {}),
    });
    const pagination = parsePagination(url.searchParams);

    const result = await listReports(session.user as Actor, {
      ...query,
      ...pagination,
    });
    return ok(result.items, result.meta);
  });
}
