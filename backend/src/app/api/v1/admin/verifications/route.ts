import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, ok } from "@/server/http/response";
import { listVerifications } from "@/server/services/verification";
import { verificationQuerySchema } from "@/server/validators/verification";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const query = verificationQuerySchema.parse(status ? { status } : {});
    const pagination = parsePagination(url.searchParams);

    const result = await listVerifications(session.user as Actor, {
      ...query,
      ...pagination,
    });

    return ok(result.items, result.meta);
  });
}
