import type { NextRequest } from "next/server";
import { parsePagination } from "@/lib/pagination";
import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { listNotifications } from "@/server/services/notifications";

/** The session user's notifications only; `?unread=true` narrows the page. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireSession();
    const searchParams = request.nextUrl.searchParams;
    const result = await listNotifications(session.user as Actor, {
      ...parsePagination(searchParams),
      unread: searchParams.get("unread") ?? undefined,
    });
    return ok(result.items, result.meta);
  });
}
