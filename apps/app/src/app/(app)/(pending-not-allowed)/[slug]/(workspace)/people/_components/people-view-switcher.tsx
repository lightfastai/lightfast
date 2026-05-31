"use client";

import { Users } from "lucide-react";
import { useQueryStates } from "nuqs";
import { ViewSwitcher } from "../../_components/views/view-switcher";
import {
  parsePersonProviders,
  parsePersonTypes,
  peopleSavedViewParser,
  personProviderParser,
  personTypeParser,
} from "./people-search-params";
import {
  ALL_PEOPLE_VIEW_NAME,
  allPeopleParamValues,
  selectionToConfig,
  viewConfigToParamValues,
} from "./people-views-model";
import {
  useCreatePeopleView,
  useDeletePeopleView,
  usePeopleViewsQuery,
} from "./use-people-views-query";

/**
 * People views bar — wires the shared <ViewSwitcher> to the people URL params
 * (3 params, written atomically via nuqs) and the people views tRPC router.
 */
export function PeopleViewSwitcher() {
  const [params, setParams] = useQueryStates({
    provider: personProviderParser,
    type: personTypeParser,
    view: peopleSavedViewParser,
  });

  const viewsQuery = usePeopleViewsQuery();
  const createView = useCreatePeopleView();
  const deleteView = useDeletePeopleView();
  const views = viewsQuery.data ?? [];
  const activeViewId = params.view;

  const currentConfig = selectionToConfig({
    providers: parsePersonProviders(params.provider),
    types: parsePersonTypes(params.type),
  });

  return (
    <ViewSwitcher
      activeViewId={activeViewId}
      allLabel={ALL_PEOPLE_VIEW_NAME}
      icon={Users}
      onCreate={async (name) => {
        const view = await createView.mutateAsync({
          config: currentConfig,
          name,
        });
        void setParams({ view: view.publicId });
      }}
      onDelete={async (publicId) => {
        await deleteView.mutateAsync({ publicId });
        if (activeViewId === publicId) {
          void setParams({ view: null });
        }
      }}
      onSelectAll={() => {
        const next = allPeopleParamValues();
        void setParams({ provider: next.provider, type: next.type, view: null });
      }}
      onSelectView={(publicId) => {
        const view = views.find((candidate) => candidate.publicId === publicId);
        if (!view) {
          return;
        }
        const next = viewConfigToParamValues(view.config);
        void setParams({
          provider: next.provider,
          type: next.type,
          view: publicId,
        });
      }}
      views={views}
    />
  );
}
