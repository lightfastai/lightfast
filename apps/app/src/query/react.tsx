import { toast } from "@repo/ui/components/ui/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { MutationCache, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { createQueryClient } from "./query-client";
import "./react-query-meta";

function isExpectedDomainError(error: unknown) {
  return (
    error instanceof Error &&
    error.name === "DomainError" &&
    error.message.trim().length > 0
  );
}

const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (mutation.options.meta?.suppressErrorToast) {
      return;
    }

    const title = mutation.options.meta?.errorTitle ?? "Something went wrong";
    const message = isExpectedDomainError(error)
      ? error.message
      : "An unexpected error occurred. Please try again.";

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

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
