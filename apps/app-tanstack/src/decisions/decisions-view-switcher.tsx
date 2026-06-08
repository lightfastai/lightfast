import { ViewSwitcher } from "~/components/views/view-switcher";
import {
  type NormalizedDecisionsSearch,
  parseDecisionProviders,
  parseDecisionStatuses,
} from "./decisions-search-params";
import {
  allDecisionsParamValues,
  selectionToConfig,
  viewConfigToParamValues,
} from "./decisions-views-model";
import {
  useCreateDecisionView,
  useDecisionViewsQuery,
  useDeleteDecisionView,
} from "./use-decision-views-query";

export function DecisionsViewSwitcher({
  search,
  setSearchParams,
}: {
  search: NormalizedDecisionsSearch;
  setSearchParams: (updates: Partial<NormalizedDecisionsSearch>) => void;
}) {
  const viewsQuery = useDecisionViewsQuery();
  const createView = useCreateDecisionView();
  const deleteView = useDeleteDecisionView();
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
