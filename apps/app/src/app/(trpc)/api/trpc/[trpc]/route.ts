import { appRouter, createTRPCContext } from "@api/app";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { env } from "~/env";
import { wwwUrl } from "~/lib/related-projects";

// Use Node.js runtime instead of Edge for GitHub App crypto operations
// Octokit requires Node.js crypto APIs for RSA key signing (not available in Edge)
export const runtime = "nodejs";

// Allowed request origins per environment — derived from related projects
// wwwUrl resolves to the correct origin per environment via VERCEL_RELATED_PROJECTS.
// In dev we also whitelist http://localhost:5173 (the Electron renderer's Vite
// dev server origin) so the desktop app can call tRPC cross-origin with a
// Bearer token.
const allowedOrigins = new Set<string>([
  wwwUrl,
  ...(env.NODE_ENV === "development"
    ? ["http://localhost:3024", "http://localhost:5173"]
    : []),
]);

const setCorsHeaders = (req: NextRequest, res: Response) => {
  const origin = req.headers.get("origin");
  if (!(origin && allowedOrigins.has(origin))) {
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
