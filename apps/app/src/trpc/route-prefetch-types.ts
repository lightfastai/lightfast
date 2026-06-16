import type { AppRouter } from "@api/app";
import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

export interface RoutePrefetchContext {
  queryClient: QueryClient;
  trpc: TRPCOptionsProxy<AppRouter>;
}
