import type { TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { headers } from "next/headers";
import {
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import {
  createTRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { ConsoleAppRouter } from "@api/console";
import { consoleAppRouter, createTRPCContext } from "@api/console";

import { createQueryClient } from "./client";

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    headers: heads,
  });
});

/**
 * Create context for internal webhook calls
 * Sets x-webhook-source header to identify server-side calls from webhook handlers
 */
const createWebhookContext = cache(async () => {
  const heads = new Headers();
  heads.set("x-trpc-source", "webhook-service");
  heads.set("x-webhook-source", "internal");

  return createTRPCContext({
    headers: heads,
  });
});

export const getQueryClient = cache(createQueryClient);

export const trpc: TRPCOptionsProxy<ConsoleAppRouter> = createTRPCOptionsProxy({
  router: consoleAppRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});

/**
 * Create a server-side tRPC caller for webhook handlers
 * This caller is authenticated as an internal webhook source
 * and should only be used by verified webhook handlers (after signature verification)
 */
export const createCaller = cache(async () => {
  const ctx = await createWebhookContext();
  return consoleAppRouter.createCaller(ctx);
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export function prefetch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryOptions: ReturnType<TRPCQueryOptions<any>>,
) {
  const queryClient = getQueryClient();
  if ((queryOptions.queryKey[1] as { type?: string } | undefined)?.type === "infinite") {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
