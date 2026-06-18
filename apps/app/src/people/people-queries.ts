import {
  type GetPersonInput,
  getPerson,
  type ListPeopleInput,
  type ListPeopleResult,
  listPeople,
  type PersonDetailResult,
} from "@api/app/tanstack/people";
import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
} from "@tanstack/react-query";

export type PeopleList = ListPeopleResult;
export type PersonRow = PeopleList["items"][number];
export type PersonDetail = PersonDetailResult;

export const peopleQueryKeys = {
  all: ["people"] as const,
  detail: (publicId: string) => ["people", "detail", publicId] as const,
  list: (input: Omit<ListPeopleInput, "cursor">) =>
    ["people", "list", input] as const,
};

export function peopleListInfiniteQueryOptions(
  input: Omit<ListPeopleInput, "cursor">
) {
  return infiniteQueryOptions({
    enabled: typeof window !== "undefined",
    getNextPageParam: (lastPage: PeopleList) => lastPage.nextCursor,
    initialPageParam: undefined as ListPeopleInput["cursor"],
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
        data: { publicId: input.publicId } satisfies GetPersonInput,
      }),
    queryKey: peopleQueryKeys.detail(input.publicId),
  });
}
