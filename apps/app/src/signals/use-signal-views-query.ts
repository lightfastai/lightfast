import {
  createSignalView,
  deleteSignalView,
  listSignalViews,
} from "@api/app/tanstack/signal-views";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SignalViewConfig } from "./signals-views-model";

const signalViewQueryKeys = {
  list: () => ["signals", "views"] as const,
};

export function useSignalViewsQuery() {
  return useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => listSignalViews(),
    queryKey: signalViewQueryKeys.list(),
    staleTime: 60_000,
  });
}

export function useCreateSignalView() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { errorTitle: "Failed to save view" },
    mutationFn: (data: { config: SignalViewConfig; name: string }) =>
      createSignalView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: signalViewQueryKeys.list(),
      }),
  });
}

export function useDeleteSignalView() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { errorTitle: "Failed to delete view" },
    mutationFn: (data: { publicId: string }) => deleteSignalView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: signalViewQueryKeys.list(),
      }),
  });
}
