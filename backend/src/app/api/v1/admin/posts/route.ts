import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, ok } from "@/server/http/response";
import { listAdminPosts } from "@/server/services/admin-moderation";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const url = new URL(request.url);
    const pagination = parsePagination(url.searchParams);

    const result = await listAdminPosts(session.user as Actor, {
      includeDeleted: url.searchParams.get("includeDeleted") ?? undefined,
      ...pagination,
    });
    return ok(result.items, result.meta);
  });
}
