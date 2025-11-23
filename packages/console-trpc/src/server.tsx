import type { TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { headers } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { UserRouter, OrgRouter } from "@api/console";
import {
  userRouter,
  orgRouter,
  createUserTRPCContext,
  createOrgTRPCContext,
} from "@api/console";
import { getM2MToken } from "@repo/console-clerk-m2m";

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

/**
 * Create context for webhook M2M calls (org-scoped)
 * Uses long-lived Clerk M2M token for webhook service
 */
const createWebhookContext = cache(async () => {
  const token = getM2MToken("webhook");

  const heads = new Headers();
  heads.set("x-trpc-source", "webhook-service");
  heads.set("authorization", `Bearer ${token}`);

  return createOrgTRPCContext({
    headers: heads,
  });
});

/**
 * Create context for Inngest M2M calls (org-scoped)
 * Uses long-lived Clerk M2M token for Inngest service
 */
const createInngestContext = cache(async () => {
  const token = getM2MToken("inngest");

  const heads = new Headers();
  heads.set("x-trpc-source", "inngest-workflow");
  heads.set("authorization", `Bearer ${token}`);

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

/**
 * Create a server-side org-scoped caller for webhook handlers
 * This caller is authenticated with webhook M2M token
 * Should only be used by verified webhook handlers (after signature verification)
 */
export const createCaller = cache(async () => {
  const ctx = await createWebhookContext();
  return orgRouter.createCaller(ctx);
});

/**
 * Create a server-side org-scoped caller for Inngest workflows
 * This caller is authenticated with Inngest M2M token
 * Should only be used by Inngest background workflows
 */
export const createInngestCaller = cache(async () => {
  const ctx = await createInngestContext();
  return orgRouter.createCaller(ctx);
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
