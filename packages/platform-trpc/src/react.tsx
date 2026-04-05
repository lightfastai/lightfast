"use client";

import type { PlatformRouter } from "@api/platform";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import SuperJSON from "superjson";

import { createQueryClient } from "./client";

export interface CreatePlatformTRPCProviderOptions {
  baseUrl?: string;
  getAuthHeaders?: () => Record<string, string>;
}

const trpcContext = createTRPCContext<PlatformRouter>();

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
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 4112}`;
}

export function PlatformTRPCReactProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  options?: CreatePlatformTRPCProviderOptions;
}) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => {
    const baseUrl = options?.baseUrl ?? defaultGetBaseUrl();

    return createTRPCClient<PlatformRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${baseUrl}/api/trpc`,
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
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
