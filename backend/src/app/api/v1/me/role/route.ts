import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { switchOwnRole } from "@/server/services/account-role";

const bodySchema = z.object({ role: z.enum(["OWNER", "INVESTOR"]) }).strict();

/** Switch account type (OWNER/INVESTOR) while the account is still empty. */
export async function PATCH(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireSession();
    const { role } = bodySchema.parse(await request.json());
    return ok(await switchOwnRole(session.user as Actor, role));
  });
}
