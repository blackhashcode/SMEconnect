import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { listSubmissions } from "@/server/services/verification-history";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/** ADMIN: every verification submission a member has made, with the documents and decisions. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const userId = idSchema.parse((await params).userId);
    return ok(await listSubmissions(session.user as Actor, userId));
  });
}
