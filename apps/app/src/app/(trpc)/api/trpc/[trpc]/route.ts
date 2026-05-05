import { appRouter, createTRPCContext } from "@api/app";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import {
  isAllowedOrigin,
  isDesktopDevOrigin,
  isPackagedDesktopRequest,
} from "~/cors";

// Use Node.js runtime instead of Edge for GitHub App crypto operations
// Octokit requires Node.js crypto APIs for RSA key signing (not available in Edge)
export const runtime = "nodejs";

const setCorsHeaders = (req: NextRequest, res: Response) => {
  const origin = req.headers.get("origin");

  if (
    !(
      isAllowedOrigin(origin) ||
      isDesktopDevOrigin(origin) ||
      isPackagedDesktopRequest(origin, req.headers)
    )
  ) {
    return res;
  }

  // Echo the request Origin when present; absent headers fall back to the
  // string "null" (Fetch-spec serialization for opaque origins, accepted by
  // Chromium for file:// renderers).
  res.headers.set("Access-Control-Allow-Origin", origin ?? "null");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "content-type,authorization,x-trpc-source,trpc-accept,x-lightfast-desktop"
  );
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");

  return res;
};

export const OPTIONS = (req: NextRequest) => {
  const response = new Response(null, { status: 204 });
  return setCorsHeaders(req, response);
};

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () => createTRPCContext({ headers: req.headers }),
  });

  return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
