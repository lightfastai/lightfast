import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function usePeopleViewsQuery() {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.org.workspace.people.views.list.queryOptions(),
    enabled: typeof window !== "undefined",
    staleTime: 60_000,
  });
}

export function useCreatePeopleView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.org.workspace.people.views.create.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.org.workspace.people.views.list.queryKey(),
        }),
    })
  );
}

export function useDeletePeopleView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.org.workspace.people.views.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.org.workspace.people.views.list.queryKey(),
        }),
    })
  );
}
