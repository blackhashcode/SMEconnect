import { requireActor } from "@/server/auth/guards";
import { created, handleRequest, ok } from "@/server/http/response";
import { writeRateLimiter } from "@/server/rate-limit";
import { getOwnVerificationStatus, submitVerification } from "@/server/services/verifications";
import { submitVerificationSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRequest(async () => {
    const actor = await requireActor();
    return ok(await getOwnVerificationStatus(actor));
  });
}

export async function POST(request: Request) {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER", "INVESTOR");
    writeRateLimiter.check(`verif:${actor.id}`);
    const body = submitVerificationSchema.parse(await request.json());
    return created(await submitVerification(actor, body));
  });
}
