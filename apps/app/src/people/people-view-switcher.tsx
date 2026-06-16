import { ViewSwitcher } from "~/components/views/view-switcher";
import {
  type NormalizedPeopleSearch,
  parsePersonProviders,
  parsePersonTypes,
} from "./people-search-params";
import {
  allPeopleParamValues,
  selectionToConfig,
  viewConfigToParamValues,
} from "./people-views-model";
import {
  useCreatePeopleView,
  useDeletePeopleView,
  usePeopleViewsQuery,
} from "./use-people-views-query";

export function PeopleViewSwitcher({
  search,
  setSearchParams,
}: {
  search: NormalizedPeopleSearch;
  setSearchParams: (updates: Partial<NormalizedPeopleSearch>) => void;
}) {
  const viewsQuery = usePeopleViewsQuery();
  const createView = useCreatePeopleView();
  const deleteView = useDeletePeopleView();
  const views = viewsQuery.data ?? [];

  const currentConfig = selectionToConfig({
    providers: parsePersonProviders(search.provider),
    types: parsePersonTypes(search.type),
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
        setSearchParams({ ...allPeopleParamValues(), view: null });
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
