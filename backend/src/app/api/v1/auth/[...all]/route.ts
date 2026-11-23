import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Better Auth returns the raw session token in sign-in/sign-up JSON bodies.
 * The browser already receives it as an HttpOnly cookie, so exposing it to
 * JavaScript would only help an XSS payload steal sessions. Strip it.
 */
async function withoutSessionToken(response: Response): Promise<Response> {
  if (!response.headers.get("content-type")?.includes("application/json")) return response;
  const body = await response.clone().json().catch(() => null);
  if (!body || typeof body !== "object" || !("token" in body)) return response;

  const rest = { ...(body as Record<string, unknown>) };
  delete rest.token;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(rest), { status: response.status, statusText: response.statusText, headers });
}

/** Better Auth owns this catch-all; the app does not reimplement its endpoints. */
async function handler(request: Request) {
  return withoutSessionToken(await auth.handler(request));
}

export { handler as GET, handler as POST };
