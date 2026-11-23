import "@/server/openapi/setup";
import { registerAuthRoutes } from "@/server/openapi/routes/auth";
import { registerDiscoveryRoutes } from "@/server/openapi/routes/discovery";
import { registerHealthRoute } from "@/server/openapi/routes/health";
import { registerLoanRequestRoutes } from "@/server/openapi/routes/loan-requests";
import { registerMessagingRoutes } from "@/server/openapi/routes/messaging";
import { registerOfferRoutes } from "@/server/openapi/routes/offers";
import { registerPhase9Routes } from "@/server/openapi/routes/phase9";
import { registerPhoneOtpRoutes } from "@/server/openapi/routes/phone-otp";
import { registerProfileRoutes } from "@/server/openapi/routes/profiles";
import { registerRepaymentRoutes } from "@/server/openapi/routes/repayments";
import { registerSocialRoutes } from "@/server/openapi/routes/social";
import { registerStorageRoutes } from "@/server/openapi/routes/storage";
import { registerVerificationRoutes } from "@/server/openapi/routes/verification";

let registered = false;

/** Registers every implemented endpoint exactly once per process. */
export function registerApiRoutes() {
  if (registered) return;
  registerHealthRoute();
  registerAuthRoutes();
  registerPhoneOtpRoutes();
  registerProfileRoutes();
  registerLoanRequestRoutes();
  registerStorageRoutes();
  registerVerificationRoutes();
  registerSocialRoutes();
  registerDiscoveryRoutes();
  registerMessagingRoutes();
  registerOfferRoutes();
  registerRepaymentRoutes();
  registerPhase9Routes();
  registered = true;
}
