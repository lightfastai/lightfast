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

import type { DeusAppRouter } from "@api/deus";
import { deusAppRouter, createTRPCContext } from "@api/deus";

import { createQueryClient } from "./client";

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    headers: heads,
  });
});

export const getQueryClient = cache(createQueryClient);

export const trpc: TRPCOptionsProxy<DeusAppRouter> = createTRPCOptionsProxy({
  router: deusAppRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});

export const createCaller = cache(async () => {
  const ctx = await createContext();
  return deusAppRouter.createCaller(ctx);
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
