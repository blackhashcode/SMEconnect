import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Better Auth owns this catch-all; the app does not reimplement its endpoints. */
async function handler(request: Request) {
  return auth.handler(request);
}

export { handler as GET, handler as POST };
