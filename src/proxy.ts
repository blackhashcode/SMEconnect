import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic guard: logged-out visitors (no session cookie) are sent to /login
 * before any member page renders. The real check happens in the (app) layout,
 * which asks the API whether the session is still valid.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("sme_session")) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/feed/:path*",
    "/explore/:path*",
    "/messages/:path*",
    "/notifications/:path*",
    "/investor-dashboard/:path*",
    "/business-dashboard/:path*",
    "/businesses/:path*",
    "/investors/:path*",
    "/loans/:path*",
    "/admin/:path*",
  ],
};
