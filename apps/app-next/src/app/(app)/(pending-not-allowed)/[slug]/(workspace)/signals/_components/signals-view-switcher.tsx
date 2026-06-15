"use client";

import { useQueryStates } from "nuqs";
import { ViewSwitcher } from "../../_components/views/view-switcher";
import {
  parseSignalDispositions,
  parseSignalKinds,
  parseSignalPriorities,
  signalDispositionParser,
  signalKindParser,
  signalPeopleParser,
  signalPriorityParser,
  signalSavedViewParser,
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

/**
 * Signals views bar — wires the shared <ViewSwitcher> to the signals URL params
 * (5 params, written atomically via nuqs) and the signals views tRPC router.
 */
export function SignalsViewSwitcher() {
  const [params, setParams] = useQueryStates({
    disposition: signalDispositionParser,
    kind: signalKindParser,
    people: signalPeopleParser,
    priority: signalPriorityParser,
    view: signalSavedViewParser,
  });

  const viewsQuery = useSignalViewsQuery();
  const createView = useCreateSignalView();
  const deleteView = useDeleteSignalView();
  const views = viewsQuery.data ?? [];
  const activeViewId = params.view;

  const currentConfig = selectionToConfig({
    dispositions: parseSignalDispositions(params.disposition),
    kinds: parseSignalKinds(params.kind),
    peopleRouted: params.people === "routed",
    priorities: parseSignalPriorities(params.priority),
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
        const next = allSignalsParamValues();
        void setParams({
          disposition: next.disposition,
          kind: next.kind,
          people: next.people,
          priority: next.priority,
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
          disposition: next.disposition,
          kind: next.kind,
          people: next.people,
          priority: next.priority,
          view: publicId,
        });
      }}
      views={views}
    />
  );
}
