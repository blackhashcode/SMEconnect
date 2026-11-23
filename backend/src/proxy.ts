import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie } from "@/server/auth/constants";
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

  if (!hasSessionCookie(request.cookies)) {
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
    "/api/v1/verifications",
    "/api/v1/verifications/:path*",
    "/api/v1/admin",
    "/api/v1/admin/:path*",
    "/api/v1/uploads",
    "/api/v1/uploads/:path*",
    "/api/v1/phone-otp",
    "/api/v1/phone-otp/:path*",
    "/api/v1/files/private",
    "/api/v1/files/private/:path*",
    "/api/v1/feed",
    "/api/v1/feed/:path*",
    "/api/v1/connections",
    "/api/v1/connections/:path*",
    "/api/v1/follows",
    "/api/v1/follows/:path*",
    "/api/v1/suggestions",
    "/api/v1/suggestions/:path*",
    "/api/v1/conversations",
    "/api/v1/conversations/:path*",
    "/api/v1/messages",
    "/api/v1/messages/:path*",
    "/api/v1/offers",
    "/api/v1/offers/:path*",
    "/api/v1/agreements",
    "/api/v1/agreements/:path*",
    "/api/v1/repayments",
    "/api/v1/repayments/:path*",
    "/api/v1/loans",
    "/api/v1/loans/:path*",
    "/api/v1/reports",
    "/api/v1/reports/:path*",
    "/api/v1/notifications",
    "/api/v1/notifications/:path*",
    "/api/v1/blocks",
    "/api/v1/blocks/:path*",
    "/api/v1/dashboard",
    "/api/v1/dashboard/:path*",
  ],
};
