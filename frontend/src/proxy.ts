import { NextResponse, type NextRequest } from "next/server";

// Better Auth's session cookie; browsers on HTTPS get the __Secure- prefixed name.
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

/**
 * Optimistic guard: logged-out visitors (no session cookie) are sent to /login
 * before any member page renders. The real check happens in the (app) layout,
 * which asks the backend whether the session is still valid.
 */
export function proxy(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/feed/:path*",
    "/connections/:path*",
    "/explore/:path*",
    "/messages/:path*",
    "/notifications/:path*",
    "/onboarding/:path*",
    "/investor-dashboard/:path*",
    "/business-dashboard/:path*",
    "/businesses/:path*",
    "/investors/:path*",
    "/loan-requests/:path*",
    "/loans/:path*",
    "/offers/:path*",
    "/admin/:path*",
  ],
};
