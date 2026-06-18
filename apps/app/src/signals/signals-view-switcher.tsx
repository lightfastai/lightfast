import {
  createSignalView,
  deleteSignalView,
  listSignalViews,
} from "@api/app/tanstack/signal-views";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ViewSwitcher } from "~/components/views/view-switcher";
import {
  type NormalizedSignalsSearch,
  parseSignalDispositions,
  parseSignalKinds,
  parseSignalPriorities,
} from "./signals-search-params";
import {
  allSignalsParamValues,
  type SignalViewConfig,
  selectionToConfig,
  viewConfigToParamValues,
} from "./signals-views-model";

const signalViewQueryKeys = {
  list: () => ["signals", "views"] as const,
};

export function SignalsViewSwitcher({
  search,
  setSearchParams,
}: {
  search: NormalizedSignalsSearch;
  setSearchParams: (updates: Partial<NormalizedSignalsSearch>) => void;
}) {
  const queryClient = useQueryClient();
  const viewsQuery = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => listSignalViews(),
    queryKey: signalViewQueryKeys.list(),
    staleTime: 60_000,
  });
  const createView = useMutation({
    meta: { errorTitle: "Failed to save view" },
    mutationFn: (data: { config: SignalViewConfig; name: string }) =>
      createSignalView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: signalViewQueryKeys.list(),
      }),
  });
  const deleteView = useMutation({
    meta: { errorTitle: "Failed to delete view" },
    mutationFn: (data: { publicId: string }) => deleteSignalView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: signalViewQueryKeys.list(),
      }),
  });
  const views = viewsQuery.data ?? [];

  const currentConfig = selectionToConfig({
    dispositions: parseSignalDispositions(search.disposition),
    kinds: parseSignalKinds(search.kind),
    peopleRouted: search.people === "routed",
    priorities: parseSignalPriorities(search.priority),
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
        setSearchParams({ ...allSignalsParamValues(), view: null });
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
