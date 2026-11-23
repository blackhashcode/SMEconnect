import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { resumeLoanRequest } from "@/server/services/loan-request";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PAUSED → OPEN. Re-checks verification, profile and the one-active rule. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER");
    const { id: rawId } = await params;
    return ok(await resumeLoanRequest(session.user as Actor, idSchema.parse(rawId)));
  });
}
