"use client";

import { useQueryState } from "nuqs";
import { useDeferredValue, useMemo } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { type DecisionFilters, flattenDecisionPages } from "./decisions-model";
import {
  decisionParser,
  decisionProviderParser,
  decisionQueryParser,
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
          if (group === "provider") {
            void setProviderState("");
          } else {
            void setStatusState("");
          }
        }}
        onQueryChange={(value) => void setQuery(value)}
        onToggleProvider={(value) =>
          void setProviderState(
            serializeDecisionValues(
              toggleDecisionValue(filters.providers, value)
            )
          )
        }
        onToggleStatus={(value) =>
          void setStatusState(
            serializeDecisionValues(
              toggleDecisionValue(filters.statuses, value)
            )
          )
        }
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
