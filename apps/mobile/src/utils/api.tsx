import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { ChatAppRouter } from "@api/chat";

import { authClient } from "./auth";
import { getBaseUrl } from "./base-url";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // add shared query defaults here if needed
    },
  },
});

/**
 * A set of typesafe hooks for consuming your API.
 */
export const trpc = createTRPCOptionsProxy<ChatAppRouter>({
  client: createTRPCClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
        colorMode: "ansi",
      }),
      httpBatchLink({
        transformer: superjson,
        url: `${getBaseUrl()}/api/trpc`,
        async headers() {
          const headers = new Map<string, string>();
          headers.set("x-trpc-source", "expo-react");

          const token = await authClient.getToken();
          if (token) {
            headers.set("Authorization", `Bearer ${token}`);
          }
          return headers;
        },
      }),
    ],
  }),
  queryClient,
});

export {
  type ChatRouterInputs as RouterInputs,
  type ChatRouterOutputs as RouterOutputs,
} from "@api/chat";
