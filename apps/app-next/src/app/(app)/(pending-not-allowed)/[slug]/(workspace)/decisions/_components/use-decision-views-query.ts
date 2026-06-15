"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function useDecisionViewsQuery() {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.org.workspace.decisions.views.list.queryOptions(),
    staleTime: 60_000,
  });
}

export function useCreateDecisionView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.org.workspace.decisions.views.create.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.org.workspace.decisions.views.list.queryKey(),
        }),
    })
  );
}

export function useDeleteDecisionView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.org.workspace.decisions.views.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.org.workspace.decisions.views.list.queryKey(),
        }),
    })
  );
}
