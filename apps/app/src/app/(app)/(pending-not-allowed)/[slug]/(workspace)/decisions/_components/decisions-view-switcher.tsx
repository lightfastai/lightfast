"use client";

import { useQueryStates } from "nuqs";
import { ViewSwitcher } from "../../_components/views/view-switcher";
import {
  decisionProviderParser,
  decisionSavedViewParser,
  decisionStatusParser,
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

/**
 * Decisions views bar — wires the shared <ViewSwitcher> to the decisions URL
 * params (3 params, written atomically via nuqs) and the decisions views tRPC
 * router.
 */
export function DecisionsViewSwitcher() {
  const [params, setParams] = useQueryStates({
    provider: decisionProviderParser,
    status: decisionStatusParser,
    view: decisionSavedViewParser,
  });

  const viewsQuery = useDecisionViewsQuery();
  const createView = useCreateDecisionView();
  const deleteView = useDeleteDecisionView();
  const views = viewsQuery.data ?? [];
  const activeViewId = params.view;

  const currentConfig = selectionToConfig({
    providers: parseDecisionProviders(params.provider),
    statuses: parseDecisionStatuses(params.status),
  });

  return (
    <ViewSwitcher
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
        const next = allDecisionsParamValues();
        void setParams({
          provider: next.provider,
          status: next.status,
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
          provider: next.provider,
          status: next.status,
          view: publicId,
        });
      }}
      views={views}
    />
  );
}
