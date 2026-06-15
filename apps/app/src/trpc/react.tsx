import type { AppRouter } from "@api/app";
import { toast } from "@repo/ui/components/ui/sonner";
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
import SuperJSON from "superjson";

import { createQueryClient } from "./query-client";
import "./react-query-meta";

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

  return import.meta.env.VITE_LIGHTFAST_APP_URL;
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => {
    const baseUrl = defaultGetBaseUrl();

    return createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: () => import.meta.env.DEV,
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${baseUrl}/api/trpc`,
          headers: () => ({
            "x-trpc-source": "client",
          }),
          fetch(url, init) {
            if (typeof window === "undefined") {
              throw new Error(
                "Server-side tRPC React fetches require request-aware auth wiring."
              );
            }

            const sameOrigin =
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
