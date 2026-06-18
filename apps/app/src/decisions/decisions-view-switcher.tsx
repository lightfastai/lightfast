import {
  createDecisionView,
  deleteDecisionView,
  listDecisionViews,
} from "@api/app/tanstack/decision-views";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ViewSwitcher } from "~/components/views/view-switcher";
import {
  type NormalizedDecisionsSearch,
  parseDecisionProviders,
  parseDecisionStatuses,
} from "./decisions-search-params";
import {
  allDecisionsParamValues,
  type DecisionViewConfig,
  selectionToConfig,
  viewConfigToParamValues,
} from "./decisions-views-model";

const decisionViewQueryKeys = {
  list: () => ["decisions", "views"] as const,
};

export function DecisionsViewSwitcher({
  search,
  setSearchParams,
}: {
  search: NormalizedDecisionsSearch;
  setSearchParams: (updates: Partial<NormalizedDecisionsSearch>) => void;
}) {
  const queryClient = useQueryClient();
  const viewsQuery = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => listDecisionViews(),
    queryKey: decisionViewQueryKeys.list(),
    staleTime: 60_000,
  });
  const createView = useMutation({
    meta: { errorTitle: "Failed to save view" },
    mutationFn: (data: { config: DecisionViewConfig; name: string }) =>
      createDecisionView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: decisionViewQueryKeys.list(),
      }),
  });
  const deleteView = useMutation({
    meta: { errorTitle: "Failed to delete view" },
    mutationFn: (data: { publicId: string }) => deleteDecisionView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: decisionViewQueryKeys.list(),
      }),
  });
  const views = viewsQuery.data ?? [];

  const currentConfig = selectionToConfig({
    providers: parseDecisionProviders(search.provider),
    statuses: parseDecisionStatuses(search.status),
  });

  return (
    <ViewSwitcher
      activeViewId={search.view}
      onCreate={async (name) => {
        const view = await createView.mutateAsync({
          config: currentConfig,
          name,
        });
        setSearchParams({ view: view.publicId });
      }}
      onDelete={async (publicId) => {
        await deleteView.mutateAsync({ publicId });
        if (search.view === publicId) {
          setSearchParams({ view: null });
        }
      }}
      onSelectAll={() => {
        setSearchParams({ ...allDecisionsParamValues(), view: null });
      }}
      onSelectView={(publicId) => {
        const view = views.find((candidate) => candidate.publicId === publicId);
        if (!view) {
          return;
        }
        setSearchParams({
          ...viewConfigToParamValues(view.config),
          view: publicId,
        });
      }}
      views={views}
    />
  );
}
