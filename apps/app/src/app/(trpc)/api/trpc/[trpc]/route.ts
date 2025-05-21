import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import type { UserSession } from "@vendor/openauth";
import { db } from "@vendor/db/client";
import { getSessionFromExternalRequest } from "@vendor/openauth/server";
import { appRouter, createTRPCContext } from "@vendor/trpc";
import { trpcHeaderNames } from "@vendor/trpc/headers";

/**
 * Configure basic CORS headers
 * You should extend this to match your needs
 */
const setCorsHeaders = (res: Response) => {
  // Allow requests from any origin during development
  // For production, restrict this to your app's domain(s)
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  // Ensure all headers used by your tRPC client are listed here
  const allowedHeaders = [
    "Content-Type",
    "Authorization",
    ...trpcHeaderNames,
  ].join(", ");
  res.headers.set("Access-Control-Allow-Headers", allowedHeaders);
  res.headers.set("Access-Control-Allow-Credentials", "true");
};

export const OPTIONS = () => {
  const response = new Response(null, {
    status: 204,
  });
  setCorsHeaders(response);
  return response;
};

const handler = async (req: Request) => {
  const session: UserSession | null = await getSessionFromExternalRequest(req);

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () =>
      createTRPCContext({
        db: db,
        session,
        headers: req.headers,
      }),
    onError({ error, path }) {
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
  });

  setCorsHeaders(response);
  return response;
};

export { handler as GET, handler as POST };
