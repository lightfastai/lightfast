import { clerkMiddleware } from "@clerk/nextjs/server";
import { getAllAppUrls } from "@repo/url-utils";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const urls = getAllAppUrls();
  
  // If user is authenticated, redirect to app
  if (userId) {
    return NextResponse.redirect(new URL(urls.app));
  }
  
  // If user is not authenticated and on root path, redirect to sign-in
  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
  
  // Continue with normal behavior
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};