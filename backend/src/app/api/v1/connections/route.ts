import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { created, handleRequest, ok } from "@/server/http/response";
import { listConnections, sendConnectionRequest } from "@/server/services/connection";
import {
  connectionListQuerySchema,
  sendConnectionRequestSchema,
} from "@/server/validators/social";

export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const filters = connectionListQuerySchema.parse(
      Object.fromEntries(
        [...searchParams.entries()].filter(
          ([key]) => key !== "cursor" && key !== "limit",
        ),
      ),
    );
    const result = await listConnections(session.user as Actor, { ...pagination, ...filters });
    return ok(result.items, result.meta);
  });
}

export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const input = sendConnectionRequestSchema.parse(await request.json());
    return created(await sendConnectionRequest(session.user as Actor, input));
  });
}
