import {
  defaultShouldDehydrateQuery,
  type MutationCache,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = (opts?: { mutationCache?: MutationCache }) =>
  new QueryClient({
    mutationCache: opts?.mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldRedactErrors: () => false,
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
