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

import { createQueryClient } from "./query-client";
import "./react-query-meta";

export interface DesktopTRPCProviderOptions {
  baseUrl: string;
  getAuthHeaders?: () =>
    | Record<string, string | undefined>
    | Promise<Record<string, string | undefined>>;
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
  return (clientQueryClientSingleton ??= createQueryClient({ mutationCache }));
}

function compactHeaders(headers: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] => {
      const [, value] = entry;
      return value !== undefined;
    })
  );
}

export function DesktopTRPCReactProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  options: DesktopTRPCProviderOptions;
}) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            import.meta.env.DEV ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${options.baseUrl.replace(/\/$/, "")}/api/trpc`,
          headers: async () =>
            compactHeaders({
              "x-trpc-source": "desktop",
              "x-lightfast-desktop": "1",
              ...((await options.getAuthHeaders?.()) ?? {}),
            }),
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
