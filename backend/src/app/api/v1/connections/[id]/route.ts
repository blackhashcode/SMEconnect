import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { removeConnection } from "@/server/services/connection";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Cancels a PENDING outgoing request or removes an ACCEPTED connection. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id: rawId } = await params;
    return ok(await removeConnection(session.user as Actor, idSchema.parse(rawId)));
  });
}
