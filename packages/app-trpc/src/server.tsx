import type { AppRouter } from "@api/app";
import { appRouter, createTRPCContext } from "@api/app";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type {
  TRPCOptionsProxy,
  TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";

import { createQueryClient } from "./client";

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ headers: heads });
});

export const getQueryClient = cache(createQueryClient);

export const trpc: TRPCOptionsProxy<AppRouter> = createTRPCOptionsProxy({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
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
  queryOptions: ReturnType<TRPCQueryOptions<any>>
) {
  const queryClient = getQueryClient();
  if (
    (queryOptions.queryKey[1] as { type?: string } | undefined)?.type ===
    "infinite"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
