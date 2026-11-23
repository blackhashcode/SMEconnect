import type { NextRequest } from "next/server";
import type { LoanRequestStatus } from "@/generated/prisma/client";
import { parsePagination } from "@/lib/pagination";
import { requireActor } from "@/server/auth/guards";
import { created, handleRequest, ok } from "@/server/http/response";
import { writeRateLimiter } from "@/server/rate-limit";
import { createLoanRequest, listLoanRequests } from "@/server/services/loans";
import { createLoanRequestSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "DRAFT",
  "OPEN",
  "IN_DISCUSSION",
  "FUNDED",
  "REPAYING",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
  "ACTIVE",
]);

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const actor = await requireActor();
    const sp = request.nextUrl.searchParams;
    const page = parsePagination(sp);
    const rawStatus = sp.get("status") ?? undefined;
    const status =
      rawStatus && ALLOWED_STATUSES.has(rawStatus)
        ? (rawStatus as LoanRequestStatus | "ACTIVE")
        : undefined;

    const result = await listLoanRequests(
      actor,
      {
        status,
        businessId: sp.get("businessId") ?? undefined,
        mine: sp.get("mine") === "1" || sp.get("mine") === "true",
        category: sp.get("category") ?? undefined,
        q: sp.get("q") ?? undefined,
      },
      page,
    );
    return ok(result.items, result.meta);
  });
}

export async function POST(request: Request) {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER");
    writeRateLimiter.check(`loan:${actor.id}`);
    const body = createLoanRequestSchema.parse(await request.json());
    return created(await createLoanRequest(actor, body));
  });
}
