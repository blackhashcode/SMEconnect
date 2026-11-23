import type { NextRequest } from "next/server";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, okPublic } from "@/server/http/response";
import { discoverInvestors } from "@/server/services/discovery";
import { investorsQuerySchema } from "@/server/validators/discovery";

/** Public discovery of APPROVED investor profiles only. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const filters = investorsQuerySchema.parse(
      Object.fromEntries(
        [...searchParams.entries()].filter(
          ([key]) => key !== "cursor" && key !== "limit",
        ),
      ),
    );
    const result = await discoverInvestors({ ...pagination, ...filters });
    return okPublic(result.items, result.meta);
  });
}
