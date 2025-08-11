import { createTRPCClient, httpBatchStreamLink, loggerLink } from "@trpc/client";
import SuperJSON from "superjson";

import type { AppRouter } from "@vendor/trpc";
import { createTRPCHeaders, $TRPCSource } from "@vendor/trpc/headers";

import { env } from "~/env";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 4106}`;
};

/**
 * Direct TRPC client for the chat app (non-React usage)
 */
export const trpc = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (op) =>
        process.env.NODE_ENV === "development" ||
        (op.direction === "down" && op.result instanceof Error),
    }),
    httpBatchStreamLink({
      transformer: SuperJSON,
      url: `${getBaseUrl()}/api/trpc`,
      headers: async () => {
        const headers = createTRPCHeaders({
          source: $TRPCSource.Enum["lightfast-chat"],
        });
        return headers;
      },
    }),
  ],
});