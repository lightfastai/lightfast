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

import type { ChatAppRouter } from "@api/chat";
import { chatAppRouter, createTRPCContext } from "@api/chat";

import { createQueryClient } from "./client";

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    headers: heads,
  });
});

export const getQueryClient = cache(createQueryClient);

export const trpc: TRPCOptionsProxy<ChatAppRouter> = createTRPCOptionsProxy({
  router: chatAppRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});

export const createCaller = cache(async () => {
  const ctx = await createContext();
  return chatAppRouter.createCaller(ctx);
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

// DO NOT REMOVE: TRPCQueryOptions<T> does not propagate the router's transformer/errorShape
// generics through ReturnType, causing TS2345 at every call site when T is specific.
// Using `any` here is intentional — the runtime is fully type-safe via the router.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prefetch(queryOptions: ReturnType<TRPCQueryOptions<any>>) {
  const queryClient = getQueryClient();
  if ((queryOptions.queryKey[1] as { type?: string } | undefined)?.type === "infinite") {
    void queryClient.prefetchInfiniteQuery(
      queryOptions as unknown as Parameters<typeof queryClient.prefetchInfiniteQuery>[0],
    );
  } else {
    void queryClient.prefetchQuery(
      queryOptions as unknown as Parameters<typeof queryClient.prefetchQuery>[0],
    );
  }
}
