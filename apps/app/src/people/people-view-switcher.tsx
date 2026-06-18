import {
  createPeopleView,
  deletePeopleView,
  listPeopleViews,
} from "@api/app/tanstack/people-views";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ViewSwitcher } from "~/components/views/view-switcher";
import {
  type NormalizedPeopleSearch,
  parsePersonProviders,
  parsePersonTypes,
} from "./people-search-params";
import {
  allPeopleParamValues,
  type PeopleViewConfig,
  selectionToConfig,
  viewConfigToParamValues,
} from "./people-views-model";

const peopleViewQueryKeys = {
  list: () => ["people", "views"] as const,
};

export function PeopleViewSwitcher({
  search,
  setSearchParams,
}: {
  search: NormalizedPeopleSearch;
  setSearchParams: (updates: Partial<NormalizedPeopleSearch>) => void;
}) {
  const queryClient = useQueryClient();
  const viewsQuery = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => listPeopleViews(),
    queryKey: peopleViewQueryKeys.list(),
    staleTime: 60_000,
  });
  const createView = useMutation({
    mutationFn: (data: { config: PeopleViewConfig; name: string }) =>
      createPeopleView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: peopleViewQueryKeys.list(),
      }),
  });
  const deleteView = useMutation({
    mutationFn: (data: { publicId: string }) => deletePeopleView({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: peopleViewQueryKeys.list(),
      }),
  });
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
