import type { NextRequest } from "next/server";
import { parsePagination } from "@/lib/pagination";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest, ok } from "@/server/http/response";
import { blockUser, listBlocks } from "@/server/services/blocks";
import { blockUserSchema } from "@/server/validators/block";

/** Users blocked by the session user. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const result = await listBlocks(session.user as Actor, parsePagination(request.nextUrl.searchParams));
    return ok(result.items, result.meta);
  });
}

/** Blocks a user and removes follows/connections with them atomically. */
export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const input = blockUserSchema.parse(await request.json());
    return created(await blockUser(session.user as Actor, input));
  });
}
