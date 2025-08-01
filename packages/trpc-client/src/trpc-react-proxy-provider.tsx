import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { SuperJSON } from "superjson";

import type { AppRouter } from "@vendor/trpc";

import { createQueryClient } from "./trpc-react-query-client";

export const queryClient = createQueryClient();

interface TRPCProxyProviderProps {
  url: string;
}

export const createTRPCOptionsProxyWrapper = ({
  url,
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
            return {};
          },
        }),
      ],
    }),
    queryClient,
  });