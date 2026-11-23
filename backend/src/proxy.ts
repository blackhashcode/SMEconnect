import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import { isProtectedApiPath } from "@/server/auth/proxy-policy";

/**
 * Optimistic pre-filter only: a missing session cookie is rejected early, but
 * a present cookie is NOT treated as a valid session. Route guards still call
 * Better Auth and enforce role/ownership on every protected endpoint.
 */
export function proxy(request: NextRequest) {
  if (!isProtectedApiPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!request.cookies.get(SESSION_COOKIE_NAME)) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/v1/me",
    "/api/v1/me/:path*",
    "/api/v1/verifications/:path*",
    "/api/v1/admin/:path*",
    "/api/v1/uploads",
    "/api/v1/uploads/:path*",
    "/api/v1/phone-otp/:path*",
    "/api/v1/files/private/:path*",
  ],
};
