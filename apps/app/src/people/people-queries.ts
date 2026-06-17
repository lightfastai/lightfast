import {
  getPerson,
  type ListPeopleResult,
  listPeople,
  type PersonDetailResult,
} from "@api/app/tanstack/people";
import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
} from "@tanstack/react-query";

type ServerFunctionData<TFn> = TFn extends (args: {
  data: infer TData;
}) => unknown
  ? TData
  : never;

type PeopleListInput = ServerFunctionData<typeof listPeople>;
type PersonDetailInput = ServerFunctionData<typeof getPerson>;

export type PeopleList = ListPeopleResult;
export type PersonRow = PeopleList["items"][number];
export type PersonDetail = PersonDetailResult;

export const peopleQueryKeys = {
  all: ["people"] as const,
  detail: (publicId: string) => ["people", "detail", publicId] as const,
  list: (input: Omit<PeopleListInput, "cursor">) =>
    ["people", "list", input] as const,
};

export function peopleListInfiniteQueryOptions(
  input: Omit<PeopleListInput, "cursor">
) {
  return infiniteQueryOptions({
    enabled: typeof window !== "undefined",
    getNextPageParam: (lastPage: PeopleList) => lastPage.nextCursor,
    initialPageParam: undefined as PeopleListInput["cursor"],
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      listPeople({
        data: {
          ...input,
          cursor: pageParam,
        },
      }),
    queryKey: peopleQueryKeys.list(input),
    staleTime: 60_000,
  });
}

export function personDetailQueryOptions(input: {
  enabled: boolean;
  publicId: string;
}) {
  return queryOptions({
    enabled: typeof window !== "undefined" && input.enabled,
    queryFn: () =>
      getPerson({
        data: { publicId: input.publicId } satisfies PersonDetailInput,
      }),
    queryKey: peopleQueryKeys.detail(input.publicId),
  });
}
