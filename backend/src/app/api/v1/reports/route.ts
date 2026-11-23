import type { NextRequest } from "next/server";
import { parsePagination } from "@/lib/pagination";
import { requireRole, requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest, ok } from "@/server/http/response";
import { createReport, listReports } from "@/server/services/reports";
import { createReportSchema, reportListQuerySchema } from "@/server/validators/social";

/** Reporters see their own reports; ADMIN sees the full queue. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireSession();
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const filters = reportListQuerySchema.parse({
      status: searchParams.get("status") ?? undefined,
    });
    const result = await listReports(session.user as Actor, {
      ...pagination,
      ...filters,
    });
    return ok(result.items, result.meta);
  });
}

/** Creates an OPEN report; resolution is an ADMIN Phase 10 operation. */
export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const input = createReportSchema.parse(await request.json());
    return created(await createReport(session.user as Actor, input));
  });
}
