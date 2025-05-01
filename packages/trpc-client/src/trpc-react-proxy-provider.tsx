import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { SuperJSON } from "superjson";

import type { AppRouter } from "@vendor/trpc";

import { createQueryClient } from "./trpc-react-query-client";

export const queryClient = createQueryClient();
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
