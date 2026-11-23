import type { NextRequest } from "next/server";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, ok } from "@/server/http/response";
import { discoverBusinesses } from "@/server/services/discovery";
import { businessesQuerySchema } from "@/server/validators/discovery";

/** Public discovery of APPROVED business profiles only. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const filters = businessesQuerySchema.parse(
      Object.fromEntries(
        [...searchParams.entries()].filter(
          ([key]) => key !== "cursor" && key !== "limit",
        ),
      ),
    );
    const result = await discoverBusinesses({ ...pagination, ...filters });
    return ok(result.items, result.meta);
  });
}
