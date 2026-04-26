import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Client-requested scope: hide/remove Connections from app flow.
 * Redirect direct visits to /connections back to Home.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/connections"],
};

