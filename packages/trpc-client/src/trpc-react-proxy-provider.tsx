import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { SuperJSON } from "superjson";

import type { AppRouter } from "@vendor/trpc";
import { TokenOrNull } from "@vendor/openauth";
import { createTRPCHeaders, TRPCSource } from "@vendor/trpc/headers";

import { createQueryClient } from "./trpc-react-query-client";

export const queryClient = createQueryClient();

interface TRPCProxyProviderProps {
  url: string;
  source: TRPCSource;
  getTokens: () => TokenOrNull | Promise<TokenOrNull>;
}

export const createTRPCOptionsProxyWrapper = ({
  url,
  source,
  getTokens,
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
          headers: async () => {
            const tokens = await getTokens();

            const headers = createTRPCHeaders({
              source,
              accessToken: tokens?.accessToken ?? undefined,
              refreshToken: tokens?.refreshToken ?? undefined,
            });

            console.log("tRPC Request Headers:", headers);
            return headers;
          },
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: "omit",
            });
          },
        }),
      ],
    }),
    queryClient,
  });
