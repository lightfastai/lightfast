import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { SuperJSON } from "superjson";

import type { AppRouter } from "@vendor/trpc";
import { createTRPCHeaders, TRPCSource } from "@vendor/trpc/headers";

import { createQueryClient } from "./trpc-react-query-client";

export const queryClient = createQueryClient();

interface TRPCProxyProviderProps {
  url: string;
  source: TRPCSource;
}

export const createTRPCOptionsProxyWrapper = ({
  url,
  source,
}: TRPCProxyProviderProps) =>
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
          headers: () => {
            // get token from auth provider
            // change to cookie...
            const accessToken = localStorage.getItem("accessToken");
            const refreshToken = localStorage.getItem("refreshToken");

            const headers = createTRPCHeaders({
              source,
              accessToken: accessToken ?? undefined,
              refreshToken: refreshToken ?? undefined,
            });

            return headers;
          },
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: "include",
            });
          },
        }),
      ],
    }),
    queryClient,
  });
