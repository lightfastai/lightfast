import { useDeferredValue, useMemo } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { DecisionsLoading } from "./decisions-loading";
import { type DecisionFilters, flattenDecisionPages } from "./decisions-model";
import {
  type NormalizedDecisionsSearch,
  parseDecisionProviders,
  parseDecisionStatuses,
  serializeDecisionValues,
  toggleDecisionValue,
} from "./decisions-search-params";
import { DecisionsTableView } from "./decisions-table-view";
import { DecisionsToolbar } from "./decisions-toolbar";
import { DecisionsViewSwitcher } from "./decisions-view-switcher";
import { useDecisionsListQuery } from "./use-decisions-list-query";

export function DecisionsClient({
  search,
  setSearchParams,
}: {
  search: NormalizedDecisionsSearch;
  setSearchParams: (updates: Partial<NormalizedDecisionsSearch>) => void;
}) {
  const deferredQuery = useDeferredValue(search.q);
  const searchText = deferredQuery.trim();
  const filters = useMemo<DecisionFilters>(
    () => ({
      providers: parseDecisionProviders(search.provider),
      statuses: parseDecisionStatuses(search.status),
    }),
    [search.provider, search.status]
  );
  const hasActiveFilters =
    searchText.length > 0 ||
    filters.providers.length > 0 ||
    filters.statuses.length > 0;

  const { query: decisionsQuery } = useDecisionsListQuery({
    filters,
    search: searchText,
  });
  const rows = flattenDecisionPages(decisionsQuery.data);

  if (decisionsQuery.isPending && rows.length === 0) {
    return (
      <WorkspaceSurface
        className="flex min-h-full flex-col bg-background"
        variant="flush"
      >
        <h1 className="sr-only">Decisions</h1>
        <DecisionsLoading />
      </WorkspaceSurface>
    );
  }

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
            setSearchParams({ provider: "", view: null });
          } else {
            setSearchParams({ status: "", view: null });
          }
        }}
        onQueryChange={(value) => setSearchParams({ q: value })}
        onToggleProvider={(value) =>
          setSearchParams({
            provider: serializeDecisionValues(
              toggleDecisionValue(filters.providers, value)
            ),
            view: null,
          })
        }
        onToggleStatus={(value) =>
          setSearchParams({
            status: serializeDecisionValues(
              toggleDecisionValue(filters.statuses, value)
            ),
            view: null,
          })
        }
        query={search.q}
        viewsSlot={
          <DecisionsViewSwitcher
            search={search}
            setSearchParams={setSearchParams}
          />
        }
      />

      <DecisionsTableView
        expandedId={search.decision}
        fetchNextPage={() => void decisionsQuery.fetchNextPage()}
        hasActiveFilters={hasActiveFilters}
        hasNextPage={!!decisionsQuery.hasNextPage}
        isError={decisionsQuery.isError}
        isFetching={decisionsQuery.isFetching}
        isFetchingNextPage={decisionsQuery.isFetchingNextPage}
        isPlaceholderData={decisionsQuery.isPlaceholderData}
        onToggleDecision={(publicId) =>
          setSearchParams({
            decision: search.decision === publicId ? null : publicId,
          })
        }
        refetch={() => void decisionsQuery.refetch()}
        rows={rows}
      />
    </WorkspaceSurface>
  );
}
