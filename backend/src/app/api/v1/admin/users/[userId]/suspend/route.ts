import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { setAdminUserStatus } from "@/server/services/admin-users";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { userId } = await params;
    return ok(
      await setAdminUserStatus(
        session.user as Actor,
        idSchema.parse(userId),
        "SUSPENDED",
      ),
    );
  });
}
