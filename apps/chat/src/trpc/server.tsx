import type { TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { headers } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { ChatAppRouter } from "@api/chat";
import { chatAppRouter, createTRPCContext } from "@api/chat";

import { createQueryClient } from "./client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
	const heads = new Headers(await headers());
	heads.set("x-trpc-source", "rsc");

	return createTRPCContext({
		headers: heads,
	});
});

export const getQueryClient = cache(createQueryClient);

// Create the TRPC proxy
export const trpc = createTRPCOptionsProxy<ChatAppRouter>({
	router: chatAppRouter,
	ctx: createContext,
	queryClient: getQueryClient,
});

/**
 * Create a tRPC caller for server-side mutations and queries
 * This is used when you need to call tRPC procedures directly from API routes
 */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
	queryOptions: T,
) {
	const queryClient = getQueryClient();
	if (queryOptions.queryKey[1]?.type === "infinite") {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
		void queryClient.prefetchInfiniteQuery(queryOptions as any);
	} else {
		void queryClient.prefetchQuery(queryOptions);
	}
}