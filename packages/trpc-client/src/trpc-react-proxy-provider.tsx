import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { SuperJSON } from "superjson";

import type { AppRouter } from "@vendor/trpc";

import { createQueryClient } from "./trpc-react-query-client";

export const queryClient = createQueryClient();
export const createTRPCOptionsProxyWrapper = ({
  url,
  accessToken,
  refreshToken,
}: {
  url: string;
  accessToken: string;
  refreshToken: string;
}) =>
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
            const headers = new Headers();
            headers.set("x-trpc-source", "electron-react");
            headers.set("x-access-token", accessToken);
            headers.set("x-refresh-token", refreshToken);
            //   const token = getToken();
            //   if (token) headers.set("Authorization", `Bearer ${token}`);
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
