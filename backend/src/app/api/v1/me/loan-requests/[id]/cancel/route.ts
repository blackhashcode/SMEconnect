import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { cancelLoanRequest } from "@/server/services/loan-request";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** DRAFT | OPEN | IN_DISCUSSION | PAUSED → CANCELLED. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER");
    const { id: rawId } = await params;
    return ok(await cancelLoanRequest(session.user as Actor, idSchema.parse(rawId)));
  });
}
