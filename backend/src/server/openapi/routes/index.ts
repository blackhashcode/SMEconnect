import "@/server/openapi/setup";
import { registerAuthRoutes } from "@/server/openapi/routes/auth";
import { registerHealthRoute } from "@/server/openapi/routes/health";
import { registerLoanRequestRoutes } from "@/server/openapi/routes/loan-requests";
import { registerPhoneOtpRoutes } from "@/server/openapi/routes/phone-otp";
import { registerProfileRoutes } from "@/server/openapi/routes/profiles";
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
  registered = true;
}
