import { appRouter, createTRPCContext } from "@api/app";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { env } from "~/env";
import { wwwUrl } from "~/lib/microfrontends";

// Use Node.js runtime instead of Edge for GitHub App crypto operations
// Octokit requires Node.js crypto APIs for RSA key signing (not available in Edge)
export const runtime = "nodejs";

// Production remains pinned to related-project origins. In development, allow
// the portless mesh and local desktop/browser origins.
const allowedOrigins = new Set<string>([wwwUrl]);

const isDevelopmentLocalOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname.endsWith(".localhost"))
    );
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin: string) => {
  if (allowedOrigins.has(origin)) {
    return true;
  }

  return env.NODE_ENV === "development" && isDevelopmentLocalOrigin(origin);
};

const setCorsHeaders = (req: NextRequest, res: Response) => {
  const origin = req.headers.get("origin");
  if (!(origin && isAllowedOrigin(origin))) {
    return res;
  }

  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "content-type,authorization,x-trpc-source,trpc-accept"
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
