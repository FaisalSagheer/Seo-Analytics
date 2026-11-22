import { NextResponse, type NextRequest } from "next/server";

/** Auth.js session cookie; "__Secure-" on https, and split into ".0", ".1" chunks when large. */
const SESSION_COOKIE = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/;

/**
 * Optimistic redirect only: checks a session cookie exists. Every page and
 * action still validates the session on the server (requireUser).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.getAll().some((c) => SESSION_COOKIE.test(c.name))) {
    return NextResponse.redirect(new URL("/sign-in?notice=signin-required", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/projects/:path*", "/team/:path*"],
};
