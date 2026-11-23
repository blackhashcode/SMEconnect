import { requireActor } from "@/server/auth/guards";
import { handleRequest, ok } from "@/server/http/response";
import { getMeProfile } from "@/server/services/profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRequest(async () => {
    const actor = await requireActor();
    return ok(await getMeProfile(actor));
  });
}
