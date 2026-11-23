import type { NextRequest } from "next/server";
import { parsePagination } from "@/lib/pagination";
import { handleRequest, ok } from "@/server/http/response";
import { listPublicLoanRequests } from "@/server/services/loan-request";
import { publicLoanRequestFiltersSchema } from "@/server/validators/loan";

/** Public, sanitized listing of OPEN requests. No session required. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const filters = publicLoanRequestFiltersSchema.parse(
      Object.fromEntries(
        [...searchParams.entries()].filter(
          ([key]) => key !== "cursor" && key !== "limit",
        ),
      ),
    );

    const result = await listPublicLoanRequests({ ...pagination, ...filters });
    return ok(result.items, result.meta);
  });
}
