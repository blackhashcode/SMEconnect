import { googleAuthEnabled } from "@/server/auth";
import { handleRequest, okPublic } from "@/server/http/response";

/** Public: which sign-in methods are configured, so the UI only shows working buttons. */
export async function GET() {
  return handleRequest(async () => okPublic({ google: googleAuthEnabled }, undefined, 300));
}
