import type { MemoryRouter } from "@api/platform";
import {
  createMemoryTRPCContext,
  memoryRouter,
  signServiceJWT,
} from "@api/platform";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type {
  TRPCOptionsProxy,
  TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";

import { createQueryClient } from "./client";

/**
 * Create context for memory RSC calls.
 * Signs a service JWT automatically with caller="app".
 */
const createMemoryContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  // Sign a service JWT for the memory service
  const token = await signServiceJWT("app");
  heads.set("authorization", `Bearer ${token}`);

  return createMemoryTRPCContext({
    headers: heads,
  });
});

export const getQueryClient = cache(createQueryClient);

/**
 * Memory tRPC proxy for RSC.
 * Automatically authenticated as "app" caller.
 */
export const memoryTrpc: TRPCOptionsProxy<MemoryRouter> =
  createTRPCOptionsProxy({
    router: memoryRouter,
    ctx: createMemoryContext,
    queryClient: getQueryClient,
  });

/**
 * Create a server-side memory caller for service use.
 * Authenticated as the specified caller identity.
 *
 * @param caller - Service identity (e.g., "app", "platform", "inngest")
 */
export const createMemoryCaller = cache(async (caller = "app") => {
  const token = await signServiceJWT(caller);

  const heads = new Headers();
  heads.set("x-trpc-source", `${caller}-service`);
  heads.set("authorization", `Bearer ${token}`);

  const ctx = await createMemoryTRPCContext({ headers: heads });
  return memoryRouter.createCaller(ctx);
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
