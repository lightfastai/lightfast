import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Redirect root to /get-started/overview (basePath adds /docs automatically)
  if (pathname === "/" || pathname === "") {
    const url = request.nextUrl.clone();
    url.pathname = "/get-started/overview";
    return NextResponse.redirect(url);
  }
  
  // Don't handle /docs redirects here - let the page handle it
  // This prevents double /docs/docs issues in multizone setup

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match the root path (after basePath is applied)
    "/",
    // Exclude static files and API routes
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};