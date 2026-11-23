import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { declineConnection } from "@/server/services/connection";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PENDING → DECLINED; only the addressee may act. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id: rawId } = await params;
    return ok(await declineConnection(session.user as Actor, idSchema.parse(rawId)));
  });
}
