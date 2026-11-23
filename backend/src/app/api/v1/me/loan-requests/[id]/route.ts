import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import {
  getMyLoanRequest,
  updateLoanRequest,
} from "@/server/services/loan-request";
import { idSchema } from "@/server/validators/common";
import { updateLoanRequestSchema } from "@/server/validators/loan";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER");
    const { id: rawId } = await params;
    return ok(await getMyLoanRequest(session.user as Actor, idSchema.parse(rawId)));
  });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER");
    const { id: rawId } = await params;
    const input = updateLoanRequestSchema.parse(await request.json());
    return ok(
      await updateLoanRequest(session.user as Actor, idSchema.parse(rawId), input),
    );
  });
}
