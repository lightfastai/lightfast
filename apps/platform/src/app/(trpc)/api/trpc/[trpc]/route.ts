import { createPlatformTRPCContext, platformRouter } from "@api/platform";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { isAllowedOrigin } from "~/cors";

export const runtime = "nodejs";

const setCorsHeaders = (req: NextRequest, res: Response) => {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
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
    router: platformRouter,
    req,
    createContext: () =>
      createPlatformTRPCContext({
        headers: req.headers,
      }),
  });

  return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
