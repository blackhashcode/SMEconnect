import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = [
  "sme_session",
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

/**
 * Optimistic guard: logged-out visitors (no session cookie) are redirected to /login
 * before any member page renders. The real session check happens in the (app) layout
 * against the API. Supports both the local stand-in cookie and Better Auth cookies.
 */
export function proxy(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    return NextResponse.next();
  }
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
