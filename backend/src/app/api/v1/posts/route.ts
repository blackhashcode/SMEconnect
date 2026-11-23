import type { NextRequest } from "next/server";
import { getSession, requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { created, handleRequest, ok } from "@/server/http/response";
import { createPost, listPosts } from "@/server/services/post";
import { createPostSchema, feedQuerySchema } from "@/server/validators/social";

/** Public, sanitized recent posts. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await getSession();
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const filters = feedQuerySchema.parse(
      Object.fromEntries(
        [...searchParams.entries()].filter(
          ([key]) => key !== "cursor" && key !== "limit",
        ),
      ),
    );
    const result = await listPosts(
      { ...pagination, ...filters },
      session ? (session.user as Actor) : undefined,
    );
    return ok(result.items, result.meta);
  });
}

/** Clients may only author UPDATE/MILESTONE posts. */
export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const input = createPostSchema.parse(await request.json());
    return created(await createPost(session.user as Actor, input));
  });
}
