import {
  type ListDecisionsResult,
  listDecisions,
} from "@api/app/tanstack/decisions";
import { useInfiniteQuery } from "@tanstack/react-query";
import { DECISIONS_PAGE_SIZE, type DecisionFilters } from "./decisions-model";

type ServerFunctionData<TFn> = TFn extends (args: {
  data: infer TData;
}) => unknown
  ? TData
  : never;

type DecisionsListInput = ServerFunctionData<typeof listDecisions>;

export function useDecisionsListQuery({
  filters,
  search,
}: {
  filters: DecisionFilters;
  search: string;
}) {
  const normalizedSearch = search.trim() || undefined;
  const input = {
    limit: DECISIONS_PAGE_SIZE,
    providers: filters.providers.length ? filters.providers : undefined,
    search: normalizedSearch,
    statuses: filters.statuses.length ? filters.statuses : undefined,
  };
  const queryKey = ["decisions", "list", input] as const;

  return {
    query: useInfiniteQuery({
      enabled: typeof window !== "undefined",
      getNextPageParam: (lastPage: ListDecisionsResult) => lastPage.nextCursor,
      initialPageParam: undefined as DecisionsListInput["cursor"],
      placeholderData: (previousData) => previousData,
      queryFn: async ({ pageParam }): Promise<ListDecisionsResult> =>
        (await listDecisions({
          data: {
            ...input,
            cursor: pageParam,
          },
        })) as ListDecisionsResult,
      queryKey,
      staleTime: 60_000,
    }),
    queryKey,
  };
}
