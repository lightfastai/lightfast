import {
  convexAuthNextjsMiddleware,
  convexAuthNextjsToken,
} from "@convex-dev/auth/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// const publicRoutes = ["/", "/signin", "/api", "/_next", "/favicon.ico"]
const authRoutes = ["/signin"]
const protectedRoutes = ["/chat", "/settings"]

async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the route is public
  // const isPublicRoute = publicRoutes.some(
  //   (route) => pathname === route || pathname.startsWith(`${route}/`),
  // )

  // Check if the route is auth-related
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )

  // Check if the route needs protection
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )

  // Get authentication status
  const token = await convexAuthNextjsToken()
  const isAuthenticated = !!token

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/chat", request.url))
  }

  // Redirect unauthenticated users to signin
  if (!isAuthenticated && isProtectedRoute) {
    const url = new URL("/signin", request.url)
    // Preserve the intended destination
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  // Add prefetch headers for chat routes to improve performance
  const response = NextResponse.next()

  if (isAuthenticated && pathname.startsWith("/chat")) {
    // Add cache headers for better navigation performance
    response.headers.set("Cache-Control", "public, max-age=0, must-revalidate")
    // Add prefetch hints for common resources
    response.headers.set(
      "Link",
      "</chat; rel=prefetch>, </chat/new; rel=prefetch>",
    )
  }

  return response
}

export default convexAuthNextjsMiddleware(middleware)

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
