import {
  createPeopleView,
  deletePeopleView,
  listPeopleViews,
} from "@api/app/tanstack/people-views";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PeopleViewConfig } from "./people-views-model";

const peopleViewQueryKeys = {
  list: () => ["people", "views"] as const,
};

export function usePeopleViewsQuery() {
  return useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => listPeopleViews(),
    queryKey: peopleViewQueryKeys.list(),
    staleTime: 60_000,
  });
}

export function useCreatePeopleView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { config: PeopleViewConfig; name: string }) =>
      createPeopleView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: peopleViewQueryKeys.list(),
      }),
  });
}

export function useDeletePeopleView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { publicId: string }) => deletePeopleView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: peopleViewQueryKeys.list(),
      }),
  });
}
