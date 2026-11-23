import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/guards";
import { ConflictError } from "@/server/errors";
import { created, handleRequest } from "@/server/http/response";
import { isUniquePhoneConflict, requestPhoneOtp } from "@/server/otp/service";
import { requestPhoneOtpSchema } from "@/server/validators/phone-otp";

export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireSession();
    const input = requestPhoneOtpSchema.parse(await request.json());

    try {
      return created(
        await requestPhoneOtp({
          userId: session.user.id,
          phone: input.phone,
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
