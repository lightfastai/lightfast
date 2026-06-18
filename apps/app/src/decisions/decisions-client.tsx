import { SidebarTrigger } from "@repo/ui-v2/components/ui/sidebar";
import { type ReactNode, useMemo } from "react";
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
  const filters = useMemo<DecisionFilters>(
    () => ({
      providers: parseDecisionProviders(search.provider),
      statuses: parseDecisionStatuses(search.status),
    }),
    [search.provider, search.status]
  );
  const hasActiveFilters =
    filters.providers.length > 0 || filters.statuses.length > 0;

  const { query: decisionsQuery } = useDecisionsListQuery({
    filters,
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
      <DecisionsViewHeader>
        <DecisionsViewSwitcher
          search={search}
          setSearchParams={setSearchParams}
        />
      </DecisionsViewHeader>
      <DecisionsToolbar
        filters={filters}
        onClearFilterGroup={(group) => {
          if (group === "provider") {
            setSearchParams({ provider: "", view: null });
          } else {
            setSearchParams({ status: "", view: null });
          }
        }}
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

function DecisionsViewHeader({ children }: { children: ReactNode }) {
  return (
    <header
      className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 py-3"
      data-testid="decisions-view-header"
    >
      <SidebarTrigger className="size-6 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden" />
      <div className="flex min-w-[12rem] flex-1 items-center overflow-hidden">
        {children}
      </div>
    </header>
  );
}
