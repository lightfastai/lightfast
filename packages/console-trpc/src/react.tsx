"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import SuperJSON from "superjson";

import type { DeusAppRouter } from "@api/console";
import { createQueryClient } from "./client";

export interface CreateTRPCReactProviderOptions {
  baseUrl?: string;
  getAuthHeaders?: () => Record<string, string>;
}

const trpcContext = createTRPCContext<DeusAppRouter>();

export const useTRPC = trpcContext.useTRPC;
export const TRPCProvider = trpcContext.TRPCProvider;

let clientQueryClientSingleton: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient();
  }

  return (clientQueryClientSingleton ??= createQueryClient());
}

function defaultGetBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 4107}`;
}

export function TRPCReactProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  options?: CreateTRPCReactProviderOptions;
}) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<DeusAppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${options?.baseUrl ?? defaultGetBaseUrl()}/api/trpc`,
          headers: () => ({
            "x-trpc-source": "client",
            ...(options?.getAuthHeaders?.() ?? {}),
          }),
          fetch(url, init) {
            return fetch(url, {
              ...init,
              credentials: "include",
            } as RequestInit);
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
