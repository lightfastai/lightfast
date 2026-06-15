"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, LoaderCircle, RefreshCw } from "lucide-react";
import { DecisionRow, ROW_GRID } from "./decision-row";
import { DecisionsEmptyState } from "./decisions-empty-state";
import {
  type DecisionRow as DecisionRowType,
  groupDecisionsByDay,
} from "./decisions-model";

export function DecisionsTableView({
  expandedId,
  fetchNextPage,
  hasActiveFilters,
  hasNextPage,
  isError,
  isFetching,
  isFetchingNextPage,
  isPlaceholderData,
  onToggleDecision,
  refetch,
  rows,
}: {
  expandedId: string | null;
  fetchNextPage: () => void;
  hasActiveFilters: boolean;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isPlaceholderData: boolean;
  onToggleDecision: (publicId: string) => void;
  refetch: () => void;
  rows: DecisionRowType[];
}) {
  if (isError && rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted-foreground text-sm">
          Could not load decisions for this workspace.
        </p>
        <Button
          aria-label="Retry loading decisions"
          onClick={refetch}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden="true" className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (rows.length === 0 && !hasActiveFilters) {
    return (
      <DecisionsEmptyState
        description="Actions Lightfast takes against Linear and X on this team's behalf will appear here."
        title="No decisions yet"
      />
    );
  }

  if (rows.length === 0 && hasActiveFilters) {
    return (
      <DecisionsEmptyState
        description="Try a different status or provider filter."
        title="No matching decisions"
      />
    );
  }

  const groups = groupDecisionsByDay(rows);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        aria-busy={isPlaceholderData}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          isPlaceholderData && "opacity-60 transition-opacity"
        )}
      >
        <div
          className={cn(
            ROW_GRID,
            "h-9 border-border/70 border-b border-l-2 border-l-transparent bg-muted/25 px-4 text-muted-foreground text-xs"
          )}
        >
          <span>Status</span>
          <span>Action</span>
          <span>Caller</span>
          <span>Source</span>
          <span>Started</span>
          <span>Duration</span>
          <span className="sr-only">Expand</span>
        </div>

        {groups.map((group) => (
          <section key={group.key}>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-border/40 border-b bg-background/95 px-4 py-1.5 text-muted-foreground text-xs backdrop-blur">
              <span className="font-medium text-foreground">{group.label}</span>
              <span>
                · {group.rows.length}{" "}
                {group.rows.length === 1 ? "action" : "actions"}
              </span>
              {group.failureCount > 0 ? (
                <span className="text-destructive">
                  · {group.failureCount} failed
                </span>
              ) : null}
            </div>

            {group.rows.map((decision) => (
              <DecisionRow
                decision={decision}
                isExpanded={expandedId === decision.publicId}
                key={decision.publicId}
                onToggle={() => onToggleDecision(decision.publicId)}
              />
            ))}
          </section>
        ))}

        {hasNextPage ? (
          <div className="px-3 py-3">
            <Button
              aria-label="Load more decisions"
              disabled={isFetchingNextPage}
              onClick={fetchNextPage}
              size="sm"
              type="button"
              variant="ghost"
            >
              {isFetchingNextPage ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                />
              ) : (
                <ChevronDown aria-hidden="true" className="size-3.5" />
              )}
              {isFetchingNextPage ? "Loading" : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 border-border/70 border-t px-4 py-2.5 text-muted-foreground text-xs">
        <span>
          {rows.length} {rows.length === 1 ? "decision" : "decisions"}
        </span>
        {isFetching && !isFetchingNextPage ? (
          <span className="flex items-center gap-1 text-muted-foreground/70">
            <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
            Refreshing
          </span>
        ) : null}
      </div>
    </div>
  );
}
