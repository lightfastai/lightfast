// import { clerkMiddleware, createRouteMatcher } from "@vendor/clerk/server";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// const isPublicRoute = createRouteMatcher([
//   "/sign-in(.*)",
//   "/sign-out(.*)",
//   "/api/health",
//   "/api/clerk/webhook(.*)",
// ]);

// export default clerkMiddleware(
//   async (auth, req) => {
//     if (!isPublicRoute(req)) {
//       await auth.protect();
//     }
//   },
//   {
//     signInUrl: "/sign-in",
//     signUpUrl: "/sign-up",
//   },
// );

// export const config = {
//   matcher: [
//     // Skip Next.js internals and all static files, unless found in search params
//     "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
//     // Always run for API routes
//     "/(api|trpc)(.*)",
//   ],
// };

export default function middleware(req: NextRequest) {
  return NextResponse.next();
}
