import type { NextRequest } from "next/server";
import { parsePagination } from "@/lib/pagination";
import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { listNotifications } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const actor = await requireActor();
    const page = parsePagination(request.nextUrl.searchParams);
    const result = await listNotifications(actor, page);
    return ok(result.items, result.meta);
  });
}
