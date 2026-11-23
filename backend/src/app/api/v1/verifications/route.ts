import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest } from "@/server/http/response";
import { submitVerification } from "@/server/services/verification";
import { submitVerificationSchema } from "@/server/validators/verification";

export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireSession();
    const input = submitVerificationSchema.parse(await request.json());

    return created(
      await submitVerification(session.user as Actor, input),
    );
  });
}
