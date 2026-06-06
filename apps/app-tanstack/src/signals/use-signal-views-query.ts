import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function useSignalViewsQuery() {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.org.workspace.signals.views.list.queryOptions(),
    staleTime: 60_000,
  });
}

export function useCreateSignalView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.org.workspace.signals.views.create.mutationOptions({
      meta: { errorTitle: "Failed to save view" },
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.org.workspace.signals.views.list.queryKey(),
        }),
    })
  );
}

export function useDeleteSignalView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.org.workspace.signals.views.delete.mutationOptions({
      meta: { errorTitle: "Failed to delete view" },
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.org.workspace.signals.views.list.queryKey(),
        }),
    })
  );
}
