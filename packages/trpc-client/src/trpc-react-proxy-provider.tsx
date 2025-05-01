import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { SuperJSON } from "superjson";

import type { AppRouter } from "@vendor/trpc";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
    },
    dehydrate: {
      serializeData: SuperJSON.serialize,
      shouldDehydrateQuery: (query) =>
        defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      shouldRedactErrors: () => {
        // We should not catch Next.js server errors
        // as that's how Next.js detects dynamic pages
        // so we cannot redact them.
        // Next.js also automatically redacts errors for us
        // with better digests.
        return false;
      },
    },
    hydrate: {
      deserializeData: SuperJSON.deserialize,
    },
  },
});

export const createTRPCOptionsProxyWrapper = ({ url }: { url: string }) =>
  createTRPCOptionsProxy<AppRouter>({
    client: createTRPCClient({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
          colorMode: "ansi",
        }),
        httpBatchLink({
          transformer: SuperJSON,
          url: `${url}/api/trpc`,
          headers() {
            const headers = new Map<string, string>();
            headers.set("x-trpc-source", "electron-react");

            //   const token = getToken();
            //   if (token) headers.set("Authorization", `Bearer ${token}`);

            return Object.fromEntries(headers);
          },
        }),
      ],
    }),
    queryClient,
  });
