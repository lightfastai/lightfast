// perf/sign-in-isolation — STEP 0: pass-through proxy (no auth, no MFE, no CSP)
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export default function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/.well-known/vercel/microfrontends/client-config",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
