"use client";

import { useQueryState } from "nuqs";
import { useDeferredValue, useMemo } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { type DecisionFilters, flattenDecisionPages } from "./decisions-model";
import {
  decisionParser,
  decisionProviderParser,
  decisionQueryParser,
  decisionSavedViewParser,
  decisionStatusParser,
  parseDecisionProviders,
  parseDecisionStatuses,
  serializeDecisionValues,
  toggleDecisionValue,
} from "./decisions-search-params";
import { DecisionsTableView } from "./decisions-table-view";
import { DecisionsToolbar } from "./decisions-toolbar";
import { useDecisionsListQuery } from "./use-decisions-list-query";

export function DecisionsClient() {
  const [query, setQuery] = useQueryState("q", decisionQueryParser);
  const deferredQuery = useDeferredValue(query);
  const search = deferredQuery.trim();
  const [providerState, setProviderState] = useQueryState(
    "provider",
    decisionProviderParser
  );
  const [statusState, setStatusState] = useQueryState(
    "status",
    decisionStatusParser
  );
  // Editing any filter in the toolbar drops the active saved view — you are now
  // on an ad-hoc selection. The switcher writes `view` + filter params together
  // (see decisions-view-switcher), so view selection does not pass through here.
  const [, setSavedViewId] = useQueryState("view", decisionSavedViewParser);
  const [expandedId, setExpandedId] = useQueryState("decision", decisionParser);

  const filters = useMemo<DecisionFilters>(
    () => ({
      providers: parseDecisionProviders(providerState),
      statuses: parseDecisionStatuses(statusState),
    }),
    [providerState, statusState]
  );
  const hasActiveFilters =
    search.length > 0 ||
    filters.providers.length > 0 ||
    filters.statuses.length > 0;

  const { query: decisionsQuery } = useDecisionsListQuery({ filters, search });
  const rows = flattenDecisionPages(decisionsQuery.data);

  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <h1 className="sr-only">Decisions</h1>
      <DecisionsToolbar
        filters={filters}
        onClearFilterGroup={(group) => {
          void setSavedViewId(null);
          if (group === "provider") {
            void setProviderState("");
          } else {
            void setStatusState("");
          }
        }}
        onQueryChange={(value) => void setQuery(value)}
        onToggleProvider={(value) => {
          void setSavedViewId(null);
          void setProviderState(
            serializeDecisionValues(
              toggleDecisionValue(filters.providers, value)
            )
          );
        }}
        onToggleStatus={(value) => {
          void setSavedViewId(null);
          void setStatusState(
            serializeDecisionValues(
              toggleDecisionValue(filters.statuses, value)
            )
          );
        }}
        query={query}
      />

      <DecisionsTableView
        expandedId={expandedId}
        fetchNextPage={() => void decisionsQuery.fetchNextPage()}
        hasActiveFilters={hasActiveFilters}
        hasNextPage={!!decisionsQuery.hasNextPage}
        isError={decisionsQuery.isError}
        isFetching={decisionsQuery.isFetching}
        isFetchingNextPage={decisionsQuery.isFetchingNextPage}
        isPlaceholderData={decisionsQuery.isPlaceholderData}
        onToggleDecision={(publicId) =>
          void setExpandedId(expandedId === publicId ? null : publicId)
        }
        refetch={() => void decisionsQuery.refetch()}
        rows={rows}
      />
    </WorkspaceSurface>
  );
}
