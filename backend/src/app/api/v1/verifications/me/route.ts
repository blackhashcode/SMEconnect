import type { Actor } from "@/server/auth/policy";
import { requireSession } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { getMyVerification } from "@/server/services/verification";

export async function GET() {
  return handleRequest(async () => {
    const session = await requireSession();
    return ok(await getMyVerification(session.user as Actor));
  });
}
