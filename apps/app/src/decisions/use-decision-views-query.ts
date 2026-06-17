import {
  createDecisionView,
  deleteDecisionView,
  listDecisionViews,
} from "@api/app/tanstack/decision-views";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DecisionViewConfig } from "./decisions-views-model";

const decisionViewQueryKeys = {
  list: () => ["decisions", "views"] as const,
};

export function useDecisionViewsQuery() {
  return useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => listDecisionViews(),
    queryKey: decisionViewQueryKeys.list(),
    staleTime: 60_000,
  });
}

export function useCreateDecisionView() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { errorTitle: "Failed to save view" },
    mutationFn: (data: { config: DecisionViewConfig; name: string }) =>
      createDecisionView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: decisionViewQueryKeys.list(),
      }),
  });
}

export function useDeleteDecisionView() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { errorTitle: "Failed to delete view" },
    mutationFn: (data: { publicId: string }) => deleteDecisionView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: decisionViewQueryKeys.list(),
      }),
  });
}
