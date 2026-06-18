import {
  type ListDecisionsInput,
  type ListDecisionsResult,
  listDecisions,
} from "@api/app/tanstack/decisions";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";

export const decisionsQueryKeys = {
  all: ["decisions"] as const,
  list: (input: Omit<ListDecisionsInput, "cursor">) =>
    ["decisions", "list", input] as const,
};

export function decisionsListInfiniteQueryOptions(
  input: Omit<ListDecisionsInput, "cursor">
) {
  return infiniteQueryOptions({
    enabled: typeof window !== "undefined",
    getNextPageParam: (lastPage: ListDecisionsResult) => lastPage.nextCursor,
    initialPageParam: undefined as ListDecisionsInput["cursor"],
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<ListDecisionsResult> =>
      (await listDecisions({
        data: {
          ...input,
          cursor: pageParam,
        },
      })) as ListDecisionsResult,
    queryKey: decisionsQueryKeys.list(input),
    staleTime: 60_000,
  });
}
