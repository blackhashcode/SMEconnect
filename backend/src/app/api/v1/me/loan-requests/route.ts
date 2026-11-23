import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { parsePagination } from "@/lib/pagination";
import { created, handleRequest, ok } from "@/server/http/response";
import {
  createLoanRequest,
  listMyLoanRequests,
} from "@/server/services/loan-request";
import { createLoanRequestSchema, myLoanRequestFiltersSchema } from "@/server/validators/loan";

/** Authenticated OWNER's own requests (all statuses), cursor-paginated. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER");
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams);
    const filters = myLoanRequestFiltersSchema.parse(
      Object.fromEntries(
        [...searchParams.entries()].filter(
          ([key]) => key !== "cursor" && key !== "limit",
        ),
      ),
    );

    const result = await listMyLoanRequests(session.user as Actor, {
      ...pagination,
      ...filters,
    });
    return ok(result.items, result.meta);
  });
}

/** Creates a DRAFT. Publishing is a separate, explicitly validated action. */
export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER");
    const input = createLoanRequestSchema.parse(await request.json());
    return created(await createLoanRequest(session.user as Actor, input));
  });
}
