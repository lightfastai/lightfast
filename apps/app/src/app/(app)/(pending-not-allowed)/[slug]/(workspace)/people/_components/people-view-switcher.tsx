"use client";

import { useQueryStates } from "nuqs";
import { ViewSwitcher } from "../../_components/views/view-switcher";
import {
  parsePersonMemberStatuses,
  parsePersonProviders,
  parsePersonSources,
  parsePersonTypes,
  peopleSavedViewParser,
  personMemberStatusParser,
  personProviderParser,
  personSourceParser,
  personTypeParser,
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

/**
 * People views bar — wires the shared <ViewSwitcher> to the people URL params
 * (3 params, written atomically via nuqs) and the people views tRPC router.
 */
export function PeopleViewSwitcher() {
  const [params, setParams] = useQueryStates({
    memberStatus: personMemberStatusParser,
    provider: personProviderParser,
    source: personSourceParser,
    type: personTypeParser,
    view: peopleSavedViewParser,
  });

  const viewsQuery = usePeopleViewsQuery();
  const createView = useCreatePeopleView();
  const deleteView = useDeletePeopleView();
  const views = viewsQuery.data ?? [];
  const activeViewId = params.view;

  const currentConfig = selectionToConfig({
    memberStatuses: parsePersonMemberStatuses(params.memberStatus),
    providers: parsePersonProviders(params.provider),
    sources: parsePersonSources(params.source),
    types: parsePersonTypes(params.type),
  });
  const activePresetId =
    params.source === "team_member,mixed" &&
    params.memberStatus === "active" &&
    !activeViewId
      ? "team_members"
      : null;

  return (
    <ViewSwitcher
      activePresetId={activePresetId}
      activeViewId={activeViewId}
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
        void setParams({
          memberStatus: next.memberStatus,
          provider: next.provider,
          source: next.source,
          type: next.type,
          view: null,
        });
      }}
      onSelectPreset={(publicId) => {
        if (publicId !== "team_members") {
          return;
        }
        void setParams({
          memberStatus: "active",
          provider: "",
          source: "team_member,mixed",
          type: "",
          view: null,
        });
      }}
      onSelectView={(publicId) => {
        const view = views.find((candidate) => candidate.publicId === publicId);
        if (!view) {
          return;
        }
        const next = viewConfigToParamValues(view.config);
        void setParams({
          memberStatus: next.memberStatus,
          provider: next.provider,
          source: next.source,
          type: next.type,
          view: publicId,
        });
      }}
      presets={[{ name: "Team Members", publicId: "team_members" }]}
      views={views}
    />
  );
}
