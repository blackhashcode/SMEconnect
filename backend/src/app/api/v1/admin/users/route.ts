import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, ok } from "@/server/http/response";
import { listAdminUsers } from "@/server/services/admin-users";
import { adminUserListQuerySchema } from "@/server/validators/admin";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const url = new URL(request.url);
    const query = adminUserListQuerySchema.parse({
      ...(url.searchParams.has("status")
        ? { status: url.searchParams.get("status") }
        : {}),
      ...(url.searchParams.has("role")
        ? { role: url.searchParams.get("role") }
        : {}),
    });
    const pagination = parsePagination(url.searchParams);

    const result = await listAdminUsers(session.user as Actor, {
      ...query,
      ...pagination,
    });
    return ok(result.items, result.meta);
  });
}
