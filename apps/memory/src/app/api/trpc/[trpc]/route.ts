import { createMemoryTRPCContext, memoryRouter } from "@api/memory";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

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
      console.error(`>>> tRPC Error on 'memory.${path}'`, error);
    },
  });

  return response;
};

export { handler as GET, handler as POST };
