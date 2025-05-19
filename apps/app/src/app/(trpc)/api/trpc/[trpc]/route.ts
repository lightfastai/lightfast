import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { authFromRequest } from "@vendor/openauth/server";
import { appRouter, createTRPCContext } from "@vendor/trpc";

/**
 * Configure basic CORS headers
 * You should extend this to match your needs
 */
const setCorsHeaders = (res: Response) => {
  // res.headers.set("Access-Control-Allow-Origin", "*");
  // res.headers.set("Access-Control-Request-Method", "*");
  // res.headers.set("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
  // res.headers.set("Access-Control-Allow-Headers", "*");
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Request-Method", "*");
  res.headers.set("Access-Control-Allow-Methods", "OPTIONS, GET");
  res.headers.set("Access-Control-Allow-Headers", "content-type");
  res.headers.set("Referrer-Policy", "no-referrer");
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
  const session = await authFromRequest(req);
  console.log("Session", session);
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () =>
      createTRPCContext({
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
