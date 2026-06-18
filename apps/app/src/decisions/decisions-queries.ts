import {
  type ListDecisionsResult,
  listDecisions,
} from "@api/app/tanstack/decisions";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";

type ServerFunctionData<TFn> = TFn extends (args: {
  data: infer TData;
}) => unknown
  ? TData
  : never;

type DecisionsListInput = ServerFunctionData<typeof listDecisions>;

export const decisionsQueryKeys = {
  all: ["decisions"] as const,
  list: (input: Omit<DecisionsListInput, "cursor">) =>
    ["decisions", "list", input] as const,
};

export function decisionsListInfiniteQueryOptions(
  input: Omit<DecisionsListInput, "cursor">
) {
  return infiniteQueryOptions({
    enabled: typeof window !== "undefined",
    getNextPageParam: (lastPage: ListDecisionsResult) => lastPage.nextCursor,
    initialPageParam: undefined as DecisionsListInput["cursor"],
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
