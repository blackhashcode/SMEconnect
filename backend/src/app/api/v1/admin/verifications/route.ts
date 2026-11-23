import type { NextRequest } from "next/server";
import type { VerificationStatus } from "@/generated/prisma/client";
import { parsePagination } from "@/lib/pagination";
import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { listVerificationQueue } from "@/server/services/verifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const actor = await requireActor("ADMIN");
    const sp = request.nextUrl.searchParams;
    const { limit } = parsePagination(sp);
    const rawStatus = sp.get("status");
    const status =
      rawStatus === "PENDING" || rawStatus === "APPROVED" || rawStatus === "REJECTED"
        ? (rawStatus as VerificationStatus)
        : undefined;
    return ok(await listVerificationQueue(actor, { status, limit }));
  });
}
