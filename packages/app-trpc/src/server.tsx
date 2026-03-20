import type { OrgRouter, UserRouter } from "@api/app";
import {
  createOrgTRPCContext,
  createUserTRPCContext,
  orgRouter,
  userRouter,
} from "@api/app";
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
 * Create context for user-scoped RSC calls
 * Allows both pending and active users
 */
const createUserContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createUserTRPCContext({
    headers: heads,
  });
});

/**
 * Create context for org-scoped RSC calls
 * Requires active org membership
 */
const createOrgContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createOrgTRPCContext({
    headers: heads,
  });
});

export const getQueryClient = cache(createQueryClient);

/**
 * User-scoped tRPC proxy for RSC
 * Use for: organization.*, account.*
 * Allows both pending and active users
 */
export const userTrpc: TRPCOptionsProxy<UserRouter> = createTRPCOptionsProxy({
  router: userRouter,
  ctx: createUserContext,
  queryClient: getQueryClient,
});

/**
 * Org-scoped tRPC proxy for RSC
 * Use for: workspace.*, integration.*, jobs.*, stores.*, sources.*, clerk.*, search.*, contents.*
 * Requires active org membership
 */
export const orgTrpc: TRPCOptionsProxy<OrgRouter> = createTRPCOptionsProxy({
  router: orgRouter,
  ctx: createOrgContext,
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
