import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { reviewVerification } from "@/server/services/verification";
import { idSchema } from "@/server/validators/common";
import { reviewVerificationSchema } from "@/server/validators/verification";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { id: rawId } = await params;
    const verificationId = idSchema.parse(rawId);
    const input = reviewVerificationSchema.parse(await request.json());

    return ok(
      await reviewVerification(session.user as Actor, verificationId, input),
    );
  });
}
