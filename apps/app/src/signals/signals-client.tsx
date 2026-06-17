import { Button } from "@repo/ui/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { SignalCreateDialog } from "./signal-create-dialog";
import { SignalDetailSheet } from "./signal-detail-sheet";
import { SignalsListView } from "./signals-list-view";
import { SignalsLoading } from "./signals-loading";
import type { SignalClassificationFilters } from "./signals-model";
import { signalDetailQueryOptions } from "./signals-queries";
import {
  type NormalizedSignalsSearch,
  parseSignalDispositions,
  parseSignalKinds,
  parseSignalPriorities,
  serializeSignalValues,
  toggleSignalValue,
} from "./signals-search-params";
import { SignalsToolbar } from "./signals-toolbar";
import { SignalsTruncationBanner } from "./signals-truncation-banner";
import { useSignalsUiStore } from "./signals-ui-store";
import { useSignalsWorkspaceData } from "./use-signals-workspace-data";

export function SignalsClient({
  search,
  setSearchParams,
}: {
  search: NormalizedSignalsSearch;
  setSearchParams: (updates: Partial<NormalizedSignalsSearch>) => void;
}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const openCreateSignal = useCallback(() => setCreateOpen(true), []);

  const collapsedGroups = useSignalsUiStore(
    (state) => state.collapsedListGroups
  );
  const toggleListGroup = useSignalsUiStore((state) => state.toggleListGroup);

  const filters = useMemo<SignalClassificationFilters>(
    () => ({
      dispositions: parseSignalDispositions(search.disposition),
      kinds: parseSignalKinds(search.kind),
      peopleRouted: search.people === "routed",
      priorities: parseSignalPriorities(search.priority),
    }),
    [search.disposition, search.kind, search.people, search.priority]
  );
  const hasActiveFilters =
    filters.dispositions.length > 0 ||
    filters.kinds.length > 0 ||
    filters.peopleRouted ||
    filters.priorities.length > 0;

  // The toolbar reflects `filters` immediately; the (cheap) list work runs on the
  // deferred value so a rapid toggle never drops a frame. With virtualized views
  // the in-memory work is trivial — this is the single hedge for the tail case.
  const deferredFilters = useDeferredValue(filters);

  const {
    hasAnyRows,
    isInitialPending,
    limit,
    signalsByPublicId,
    truncated,
    visibleListSections,
    windowDays,
  } = useSignalsWorkspaceData({ filters: deferredFilters });

  const prefetchSignal = useCallback(
    (publicId: string) => {
      const cached = signalsByPublicId.get(publicId);
      if (cached && "input" in cached) {
        return; // processing/full rows already carry the body
      }
      void queryClient.prefetchQuery(
        signalDetailQueryOptions({ enabled: true, publicId })
      );
    },
    [queryClient, signalsByPublicId]
  );

  const emptyCreateAction = (
    <Button
      className="h-6 rounded-lg border border-border/70 bg-muted/30 px-2.5 font-normal text-muted-foreground text-sm hover:bg-muted/60 hover:text-foreground"
      onClick={openCreateSignal}
      size="sm"
      type="button"
      variant="ghost"
    >
      Add Signal
    </Button>
  );

  if (isInitialPending) {
    return (
      <WorkspaceSurface
        className="flex min-h-full flex-col bg-background"
        variant="flush"
      >
        <h1 className="sr-only">Signals</h1>
        <SignalsLoading />
      </WorkspaceSurface>
    );
  }

  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <h1 className="sr-only">Signals</h1>
      <SignalsToolbar
        filters={filters}
        onAddSignal={openCreateSignal}
        onClearFilterGroup={(group) => {
          if (group === "disposition") {
            setSearchParams({ disposition: "", view: null });
          } else if (group === "kind") {
            setSearchParams({ kind: "", view: null });
          } else if (group === "people") {
            setSearchParams({ people: "all", view: null });
          } else {
            setSearchParams({ priority: "", view: null });
          }
        }}
        onPeopleRoutedChange={(value) => {
          setSearchParams({ people: value ? "routed" : "all", view: null });
        }}
        onToggleDisposition={(value) => {
          setSearchParams({
            disposition: serializeSignalValues(
              toggleSignalValue(filters.dispositions, value)
            ),
            view: null,
          });
        }}
        onToggleKind={(value) => {
          setSearchParams({
            kind: serializeSignalValues(
              toggleSignalValue(filters.kinds, value)
            ),
            view: null,
          });
        }}
        onTogglePriority={(value) => {
          setSearchParams({
            priority: serializeSignalValues(
              toggleSignalValue(filters.priorities, value)
            ),
            view: null,
          });
        }}
      />

      <SignalsTruncationBanner
        limit={limit}
        truncated={truncated}
        windowDays={windowDays}
      />

      <SignalsListView
        collapsedGroups={collapsedGroups}
        emptyAction={emptyCreateAction}
        hasActiveSearch={hasActiveFilters}
        hasAnyRows={hasAnyRows}
        onPrefetchSignal={prefetchSignal}
        onSelectSignal={(publicId) => setSearchParams({ signal: publicId })}
        onToggleGroup={toggleListGroup}
        sections={visibleListSections}
        selectedSignalId={search.signal}
      />

      <SignalDetailSheet
        initialItem={
          search.signal ? signalsByPublicId.get(search.signal) : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams({ signal: null });
          }
        }}
        publicId={search.signal}
      />
      <SignalCreateDialog onOpenChange={setCreateOpen} open={createOpen} />
    </WorkspaceSurface>
  );
}
