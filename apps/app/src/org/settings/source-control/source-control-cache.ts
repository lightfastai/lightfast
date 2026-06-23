import type {
  ListSourceControlRepositoriesResult,
  SourceControlConnectionResult,
} from "@api/app/tanstack/source-control";

export type SourceControlConnection = NonNullable<
  SourceControlConnectionResult["binding"]
>;
export type SourceControlRepositories = ListSourceControlRepositoriesResult;
export type SourceControlRepositoryRow =
  ListSourceControlRepositoriesResult["repositories"][number];

export const sourceControlConnectionQueryKey = [
  "source-control",
  "connection",
] as const;
export const sourceControlRepositoriesQueryKey = [
  "source-control",
  "repositories",
] as const;

export function sourceControlConnectionFromRepositories(
  data: ListSourceControlRepositoriesResult
): SourceControlConnectionResult {
  if (!data.binding) {
    return { binding: null, status: "unbound" };
  }

  return { binding: data.binding, status: "bound" };
}
