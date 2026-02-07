"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
  splitLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import SuperJSON from "superjson";

import type { UserRouter, OrgRouter } from "@api/console";
import { createQueryClient } from "./client";

export interface CreateTRPCReactProviderOptions {
  baseUrl?: string;
  getAuthHeaders?: () => Record<string, string>;
}

/**
 * Combined router type for client-side usage
 * Merges user-scoped and org-scoped routers
 */
type ConsoleRouters = UserRouter & OrgRouter;

const trpcContext = createTRPCContext<ConsoleRouters>();

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
  return `http://localhost:${process.env.PORT ?? 4104}`;
}

export function TRPCReactProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  options?: CreateTRPCReactProviderOptions;
}) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => {
    const baseUrl = options?.baseUrl ?? defaultGetBaseUrl();

    return createTRPCClient<ConsoleRouters>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        // Split link routes calls to correct endpoint based on procedure
        splitLink({
          condition: (op) => {
            // User-scoped procedures: organization.*, account.*, workspaceAccess.*, notifications.*
            const path = op.path;
            return (
              path.startsWith("organization.") ||
              path.startsWith("account.") ||
              path.startsWith("workspaceAccess.") ||
              path.startsWith("userSources.") ||
              path.startsWith("userApiKeys.") ||
              path.startsWith("notifications.")
            );
          },
          // True branch: user-scoped endpoint
          true: httpBatchStreamLink({
            transformer: SuperJSON,
            url: `${baseUrl}/api/trpc/user`,
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
          // False branch: org-scoped endpoint
          false: httpBatchStreamLink({
            transformer: SuperJSON,
            url: `${baseUrl}/api/trpc/org`,
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
        }),
      ],
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
