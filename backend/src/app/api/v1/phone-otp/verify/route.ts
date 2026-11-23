import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/guards";
import { ConflictError } from "@/server/errors";
import { handleRequest, ok } from "@/server/http/response";
import { isUniquePhoneConflict, verifyPhoneOtp } from "@/server/otp/service";
import { verifyPhoneOtpSchema } from "@/server/validators/phone-otp";

export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireSession();
    const input = verifyPhoneOtpSchema.parse(await request.json());

    try {
      return ok(
        await verifyPhoneOtp({
          userId: session.user.id,
          phone: input.phone,
          otp: input.otp,
        }),
      );
    } catch (error) {
      if (isUniquePhoneConflict(error)) {
        throw new ConflictError("Phone number is already in use");
      }
      throw error;
    }
  });
}
