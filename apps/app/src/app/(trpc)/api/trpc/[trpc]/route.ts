import { appRouter, createTRPCContext } from "@api/app";
import { captureException } from "@sentry/nextjs";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";
import { env } from "~/env";
import { wwwUrl } from "~/lib/related-projects";

// Use Node.js runtime instead of Edge for GitHub App crypto operations
// Octokit requires Node.js crypto APIs for RSA key signing (not available in Edge)
export const runtime = "nodejs";

/** tRPC error codes that represent expected domain conditions, not bugs. */
const EXPECTED_TRPC_ERRORS = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PARSE_ERROR",
  "UNPROCESSABLE_CONTENT",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
]);

// Allowed request origins per environment — derived from related projects
// wwwUrl resolves to the correct origin per environment via VERCEL_RELATED_PROJECTS
const allowedOrigins = new Set<string>([
  wwwUrl,
  ...(env.NODE_ENV === "development" ? ["http://localhost:3024"] : []),
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
    "content-type,authorization,x-trpc-source"
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
    onError({ error, path }) {
      if (EXPECTED_TRPC_ERRORS.has(error.code)) {
        log.info("[trpc] expected error", {
          path,
          code: error.code,
        });
      } else {
        log.error("[trpc] unexpected error", {
          path,
          error: error.message,
          code: error.code,
        });
        captureException(error);
      }
    },
  });

  return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
