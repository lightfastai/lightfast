"use client";

import type {
	QueryClient} from "@tanstack/react-query";
import {
	QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import {
	createTRPCClient,
	httpBatchStreamLink,
	loggerLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import SuperJSON from "superjson";

import type { CloudAppRouter } from "@api/cloud";
import { createQueryClient } from "./client";
import { env } from "~/env";

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
	if (typeof window === "undefined") {
		// Server: always make a new query client
		return createQueryClient();
	} else {
		// Browser: use singleton pattern to keep the same query client
		return (clientQueryClientSingleton ??= createQueryClient());
	}
};

export const { useTRPC, TRPCProvider } = createTRPCContext<CloudAppRouter>();

export function TRPCReactProvider(props: { children: React.ReactNode }) {
	const queryClient = getQueryClient();

	const [trpcClient] = useState(() =>
		createTRPCClient<CloudAppRouter>({
			links: [
				loggerLink({
					enabled: (op) =>
						env.NODE_ENV === "development" ||
						(op.direction === "down" && op.result instanceof Error),
				}),
				httpBatchStreamLink({
					transformer: SuperJSON,
					url: getBaseUrl() + "/api/trpc",
					headers() {
						return {
							"x-trpc-source": "client",
						};
					},
				}),
			],
		}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				{props.children}
			</TRPCProvider>
		</QueryClientProvider>
	);
}

const getBaseUrl = () => {
	if (typeof window !== "undefined") return window.location.origin;
	if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
	return `http://localhost:${process.env.PORT ?? 4104}`;
};