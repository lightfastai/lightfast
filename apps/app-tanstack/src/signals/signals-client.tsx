import { Button } from "@repo/ui/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { useTRPC } from "~/trpc/react";
import { SignalCreateDialog } from "./signal-create-dialog";
import { SignalDetailSheet } from "./signal-detail-sheet";
import { SignalsListView } from "./signals-list-view";
import type { SignalClassificationFilters } from "./signals-model";
import {
  type NormalizedSignalsSearch,
  parseSignalDispositions,
  parseSignalKinds,
  parseSignalPriorities,
  type SignalsSearchKey,
  serializeSignalValues,
  toggleSignalValue,
} from "./signals-search-params";
import { SignalsToolbar } from "./signals-toolbar";
import { SignalsTruncationBanner } from "./signals-truncation-banner";
import { useSignalsUiStore } from "./signals-ui-store";
import { useSignalsWorkspaceData } from "./use-signals-workspace-data";

export function SignalsClient({
  search,
  setSearchParam,
}: {
  search: NormalizedSignalsSearch;
  setSearchParam: (key: SignalsSearchKey, value: string | null) => void;
}) {
  const trpc = useTRPC();
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
        trpc.org.workspace.signals.get.queryOptions({ publicId })
      );
    },
    [queryClient, signalsByPublicId, trpc]
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
            setSearchParam("disposition", null);
          } else if (group === "kind") {
            setSearchParam("kind", null);
          } else if (group === "people") {
            setSearchParam("people", "all");
          } else {
            setSearchParam("priority", null);
          }
        }}
        onPeopleRoutedChange={(value) => {
          setSearchParam("people", value ? "routed" : "all");
        }}
        onToggleDisposition={(value) => {
          setSearchParam(
            "disposition",
            serializeSignalValues(
              toggleSignalValue(filters.dispositions, value)
            )
          );
        }}
        onToggleKind={(value) => {
          setSearchParam(
            "kind",
            serializeSignalValues(toggleSignalValue(filters.kinds, value))
          );
        }}
        onTogglePriority={(value) => {
          setSearchParam(
            "priority",
            serializeSignalValues(toggleSignalValue(filters.priorities, value))
          );
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
        onSelectSignal={(publicId) => setSearchParam("signal", publicId)}
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
            setSearchParam("signal", null);
          }
        }}
        publicId={search.signal}
      />
      <SignalCreateDialog onOpenChange={setCreateOpen} open={createOpen} />
    </WorkspaceSurface>
  );
}
