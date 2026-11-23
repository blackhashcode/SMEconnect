import { requireActor } from "@/server/auth/guards";
import { created, handleRequest, ok } from "@/server/http/response";
import { writeRateLimiter } from "@/server/rate-limit";
import { listConnections, requestConnection } from "@/server/services/connections";
import { createConnectionSchema } from "@/server/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRequest(async () => {
    const actor = await requireActor();
    return ok(await listConnections(actor));
  });
}

export async function POST(request: Request) {
  return handleRequest(async () => {
    const actor = await requireActor("OWNER", "INVESTOR");
    writeRateLimiter.check(`conn:${actor.id}`);
    const body = createConnectionSchema.parse(await request.json());
    return created(await requestConnection(actor, body));
  });
}
