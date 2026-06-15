"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useCallback, useDeferredValue, useMemo } from "react";
import { useWorkspaceCommands } from "~/components/workspace-command-menu";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { useTRPC } from "~/trpc/react";
import { SignalDetailSheet } from "./signal-detail-sheet";
import { SignalsListView } from "./signals-list-view";
import type { SignalClassificationFilters } from "./signals-model";
import {
  parseSignalDispositions,
  parseSignalKinds,
  parseSignalPriorities,
  serializeSignalValues,
  signalDispositionParser,
  signalKindParser,
  signalParser,
  signalPeopleParser,
  signalPriorityParser,
  signalSavedViewParser,
  toggleSignalValue,
} from "./signals-search-params";
import { SignalsToolbar } from "./signals-toolbar";
import { SignalsTruncationBanner } from "./signals-truncation-banner";
import { useSignalsUiStore } from "./signals-ui-store";
import { useSignalsWorkspaceData } from "./use-signals-workspace-data";

export function SignalsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { openCreateSignal } = useWorkspaceCommands();
  const [dispositionState, setDispositionState] = useQueryState(
    "disposition",
    signalDispositionParser
  );
  const [kindState, setKindState] = useQueryState("kind", signalKindParser);
  const [peopleState, setPeopleState] = useQueryState(
    "people",
    signalPeopleParser
  );
  const [priorityState, setPriorityState] = useQueryState(
    "priority",
    signalPriorityParser
  );
  // Editing any filter in the toolbar drops the active saved view: you are now
  // on an ad-hoc selection. Selecting a view (in the topbar switcher) writes
  // these same params directly, so it does not pass through here.
  const [, setSavedViewId] = useQueryState("view", signalSavedViewParser);
  const [selectedSignalId, setSelectedSignalId] = useQueryState(
    "signal",
    signalParser
  );

  const collapsedGroups = useSignalsUiStore(
    (state) => state.collapsedListGroups
  );
  const toggleListGroup = useSignalsUiStore((state) => state.toggleListGroup);

  const filters = useMemo<SignalClassificationFilters>(
    () => ({
      dispositions: parseSignalDispositions(dispositionState),
      kinds: parseSignalKinds(kindState),
      peopleRouted: peopleState === "routed",
      priorities: parseSignalPriorities(priorityState),
    }),
    [dispositionState, kindState, peopleState, priorityState]
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
          void setSavedViewId(null);
          if (group === "disposition") {
            void setDispositionState("");
          } else if (group === "kind") {
            void setKindState("");
          } else if (group === "people") {
            void setPeopleState("all");
          } else {
            void setPriorityState("");
          }
        }}
        onPeopleRoutedChange={(value) => {
          void setSavedViewId(null);
          void setPeopleState(value ? "routed" : "all");
        }}
        onToggleDisposition={(value) => {
          void setSavedViewId(null);
          void setDispositionState(
            serializeSignalValues(
              toggleSignalValue(filters.dispositions, value)
            )
          );
        }}
        onToggleKind={(value) => {
          void setSavedViewId(null);
          void setKindState(
            serializeSignalValues(toggleSignalValue(filters.kinds, value))
          );
        }}
        onTogglePriority={(value) => {
          void setSavedViewId(null);
          void setPriorityState(
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
        onSelectSignal={(publicId) => void setSelectedSignalId(publicId)}
        onToggleGroup={toggleListGroup}
        sections={visibleListSections}
        selectedSignalId={selectedSignalId}
      />

      <SignalDetailSheet
        initialItem={
          selectedSignalId ? signalsByPublicId.get(selectedSignalId) : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            void setSelectedSignalId(null);
          }
        }}
        publicId={selectedSignalId}
        slug={slug}
      />
    </WorkspaceSurface>
  );
}
