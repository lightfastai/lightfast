import type {
  ListPeopleInput,
  ListPeopleResult,
  PersonDetailResult,
} from "@api/app/tanstack/people";

export type PeopleList = ListPeopleResult;
export type PersonRow = PeopleList["items"][number];
export type PersonDetail = PersonDetailResult;

export const peopleQueryKeys = {
  all: ["people"] as const,
  detail: (publicId: string) => ["people", "detail", publicId] as const,
  list: (input: Omit<ListPeopleInput, "cursor">) =>
    ["people", "list", input] as const,
};
