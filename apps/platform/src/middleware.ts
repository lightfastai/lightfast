/**
 * Memory service middleware.
 *
 * No Clerk auth — memory uses JWT service tokens.
 * Middleware handles:
 * 1. CORS for cross-origin tRPC calls from console (separate domain)
 * 2. Security headers
 * 3. Request logging
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const getAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();

  // Production origins
  origins.add("https://lightfast.ai");
  origins.add("https://memory.lightfast.ai");

  if (process.env.NODE_ENV === "development") {
    origins.add("http://localhost:4107"); // Console
    origins.add("http://localhost:3024"); // Microfrontends proxy
    origins.add("http://localhost:4112"); // Memory (self)
  }

  return origins;
};

export default function middleware(req: NextRequest) {
  const response = NextResponse.next();

  // CORS headers for cross-origin requests
  const originHeader = req.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();

  if (originHeader && allowedOrigins.has(originHeader)) {
    response.headers.set("Access-Control-Allow-Origin", originHeader);
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "content-type,authorization,x-trpc-source,x-api-key"
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
