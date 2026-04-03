import { createMemoryTRPCContext, memoryRouter } from "@api/platform";
import { captureException } from "@sentry/nextjs";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";
import { appUrl } from "~/lib/related-projects";

export const runtime = "nodejs";

const setCorsHeaders = (req: NextRequest, res: Response) => {
  const origin = req.headers.get("origin");
  // Only the app calls platform tRPC — appUrl resolves per environment via VERCEL_RELATED_PROJECTS
  if (origin !== appUrl) {
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
    router: memoryRouter,
    req,
    createContext: () =>
      createMemoryTRPCContext({
        headers: req.headers,
      }),
    onError({ error, path }) {
      log.error("[trpc] procedure error", {
        path,
        error: error.message,
        code: error.code,
      });
      if (error.code === "INTERNAL_SERVER_ERROR") {
        captureException(error);
      }
    },
  });

  return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
