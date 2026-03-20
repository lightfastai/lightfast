/**
 * Platform service middleware.
 *
 * No Clerk auth — platform uses JWT service tokens.
 * Middleware handles security headers only via @vendor/security (nosecone).
 * CORS is handled per-endpoint (e.g. /api/trpc/[trpc]/route.ts).
 */
import {
  noseconeOptions,
  securityMiddleware,
} from "@vendor/security/middleware";
import type { NextRequest } from "next/server";

const securityHeaders = securityMiddleware(noseconeOptions);

export default async function middleware(_req: NextRequest) {
  return await securityHeaders();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
