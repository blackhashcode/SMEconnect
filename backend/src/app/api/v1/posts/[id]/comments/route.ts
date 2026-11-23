import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { created, handleRequest, ok } from "@/server/http/response";
import { createComment, listComments } from "@/server/services/post";
import { idSchema } from "@/server/validators/common";
import { createCommentSchema } from "@/server/validators/social";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const { id: rawId } = await params;
    const result = await listComments(idSchema.parse(rawId), parsePagination(request.nextUrl.searchParams));
    return ok(result.items, result.meta);
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { id: rawId } = await params;
    const input = createCommentSchema.parse(await request.json());
    return created(await createComment(session.user as Actor, idSchema.parse(rawId), input));
  });
}
