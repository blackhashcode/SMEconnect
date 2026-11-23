import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getMe, updateMe } from "@/server/services/profile";
import { updateMeSchema } from "@/server/validators/profile";

export async function GET() {
  return handleRequest(async () => {
    const session = await requireSession();
    return ok(await getMe(session.user as Actor));
  });
}

export async function PATCH(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireSession();
    const input = updateMeSchema.parse(await request.json());
    return ok(await updateMe(session.user as Actor, input));
  });
}
