import { ViewSwitcher } from "~/components/views/view-switcher";
import {
  type NormalizedSignalsSearch,
  parseSignalDispositions,
  parseSignalKinds,
  parseSignalPriorities,
} from "./signals-search-params";
import {
  allSignalsParamValues,
  selectionToConfig,
  viewConfigToParamValues,
} from "./signals-views-model";
import {
  useCreateSignalView,
  useDeleteSignalView,
  useSignalViewsQuery,
} from "./use-signal-views-query";

export function SignalsViewSwitcher({
  search,
  setSearchParams,
}: {
  search: NormalizedSignalsSearch;
  setSearchParams: (updates: Partial<NormalizedSignalsSearch>) => void;
}) {
  const viewsQuery = useSignalViewsQuery();
  const createView = useCreateSignalView();
  const deleteView = useDeleteSignalView();
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
