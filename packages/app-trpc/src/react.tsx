"use client";

import type { AppRouter } from "@api/app";
import type { QueryClient } from "@tanstack/react-query";
import { MutationCache, QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
  TRPCClientError,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { toast } from "sonner";
import SuperJSON from "superjson";
import { createQueryClient } from "./client";

export interface CreateTRPCReactProviderOptions {
  baseUrl?: string;
  getAuthHeaders?: () =>
    | Record<string, string>
    | Promise<Record<string, string>>;
}

const trpcContext = createTRPCContext<AppRouter>();

export const useTRPC = trpcContext.useTRPC;
export const TRPCProvider = trpcContext.TRPCProvider;

const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (mutation.options.meta?.suppressErrorToast) {
      return;
    }

    const title = mutation.options.meta?.errorTitle ?? "Something went wrong";

    let message = "An unexpected error occurred. Please try again.";
    if (
      error instanceof TRPCClientError &&
      error.data?.httpStatus != null &&
      error.data.httpStatus < 500
    ) {
      message = error.message;
    }

    toast.error(title, { description: message });
  },
});

let clientQueryClientSingleton: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient();
  }

  return (clientQueryClientSingleton ??= createQueryClient({ mutationCache }));
}

function defaultGetBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
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

    return createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${baseUrl}/api/trpc`,
          headers: async () => ({
            "x-trpc-source": "client",
            ...((await options?.getAuthHeaders?.()) ?? {}),
          }),
          fetch(url, init) {
            const sameOrigin =
              typeof window !== "undefined" &&
              new URL(url.toString(), window.location.origin).origin ===
                window.location.origin;
            return fetch(url, {
              ...init,
              credentials: sameOrigin ? "include" : "omit",
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
