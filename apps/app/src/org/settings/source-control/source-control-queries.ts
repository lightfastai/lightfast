import {
  getSourceControlConnection,
  importSourceControlRepository,
  type ListSourceControlRepositoriesResult,
  listSourceControlRepositories,
  type SourceControlConnectionResult,
} from "@api/app/tanstack/source-control";
import {
  mutationOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";

export type SourceControlConnection = NonNullable<
  SourceControlConnectionResult["binding"]
>;
export type SourceControlRepositories = ListSourceControlRepositoriesResult;
export type SourceControlRepositoryRow =
  ListSourceControlRepositoriesResult["repositories"][number];

export const sourceControlQueryKeys = {
  all: ["source-control"] as const,
  connection: () => ["source-control", "connection"] as const,
  repositories: () => ["source-control", "repositories"] as const,
};

export function sourceControlConnectionQueryOptions() {
  return queryOptions({
    enabled: typeof window !== "undefined",
    queryFn: () => getSourceControlConnection(),
    queryKey: sourceControlQueryKeys.connection(),
    staleTime: 30_000,
  });
}

export function sourceControlRepositoriesQueryOptions() {
  return queryOptions({
    enabled: typeof window !== "undefined",
    queryFn: () => listSourceControlRepositories(),
    queryKey: sourceControlQueryKeys.repositories(),
  });
}

export function importSourceControlRepositoryMutationOptions(input: {
  onImported?: () => void;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to add repository" },
    mutationFn: (data: { repositoryId: string }) =>
      importSourceControlRepository({ data }),
    onSuccess: (data) => {
      input.queryClient.setQueryData(
        sourceControlQueryKeys.repositories(),
        data
      );
      input.queryClient.setQueryData(
        sourceControlQueryKeys.connection(),
        data.binding
          ? {
              binding: data.binding,
              status: "bound" as const,
            }
          : {
              binding: null,
              status: "unbound" as const,
            }
      );
      input.onImported?.();
    },
  });
}
