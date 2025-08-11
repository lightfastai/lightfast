import { cache } from "react";
import { headers } from "next/headers";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { QueryClient } from "@tanstack/react-query";

import type { AppRouter } from "@vendor/trpc";
import { appRouter, createTRPCContext } from "@vendor/trpc";
import { $TRPCHeaderName } from "@vendor/trpc/headers";

/**
 * Create a query client for server-side usage
 */
const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Since this is server-side, we don't need stale time
        staleTime: 0,
      },
    },
  });
};

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set($TRPCHeaderName.Enum["x-lightfast-trpc-source"], "lightfast-chat-rsc");

  return createTRPCContext({
    headers: heads,
  });
});

export const getQueryClient = cache(createQueryClient);

/**
 * Server-side TRPC client for the chat app
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});