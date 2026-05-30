"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import { useCallback, useDeferredValue, useMemo } from "react";
import { useWorkspaceCommands } from "~/components/workspace-command-menu";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { useTRPC } from "~/trpc/react";
import { SignalDetailSheet } from "./signal-detail-sheet";
import { SignalsBoardView } from "./signals-board-view";
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
  signalViewParser,
  toggleSignalValue,
} from "./signals-search-params";
import { SignalsToolbar } from "./signals-toolbar";
import { SignalsTruncationBanner } from "./signals-truncation-banner";
import { useSignalsUiStore } from "./signals-ui-store";
import { useSignalsWorkspaceData } from "./use-signals-workspace-data";

export function SignalsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
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
  const [view, setView] = useQueryState("view", signalViewParser);
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
    boardSections,
    hasAnyRows,
    signalsByPublicId,
    truncated,
    visibleListSections,
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
      className="h-8 rounded-full px-3"
      onClick={openCreateSignal}
      size="sm"
      type="button"
      variant="outline"
    >
      <Plus aria-hidden="true" className="size-3.5" />
      Add
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
            void setDispositionState("");
          } else if (group === "kind") {
            void setKindState("");
          } else if (group === "people") {
            void setPeopleState("all");
          } else {
            void setPriorityState("");
          }
        }}
        onPeopleRoutedChange={(value) =>
          void setPeopleState(value ? "routed" : "all")
        }
        onToggleDisposition={(value) =>
          void setDispositionState(
            serializeSignalValues(
              toggleSignalValue(filters.dispositions, value)
            )
          )
        }
        onToggleKind={(value) =>
          void setKindState(
            serializeSignalValues(toggleSignalValue(filters.kinds, value))
          )
        }
        onTogglePriority={(value) =>
          void setPriorityState(
            serializeSignalValues(toggleSignalValue(filters.priorities, value))
          )
        }
        onViewChange={(value) => void setView(value)}
        view={view}
      />

      <SignalsTruncationBanner truncated={truncated} />

      {view === "board" ? (
        <SignalsBoardView
          emptyAction={emptyCreateAction}
          hasActiveSearch={hasActiveFilters}
          hasAnyRows={hasAnyRows}
          onPrefetchSignal={prefetchSignal}
          onSelectSignal={(publicId) => void setSelectedSignalId(publicId)}
          sections={boardSections}
          selectedSignalId={selectedSignalId}
        />
      ) : (
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
      )}

      <SignalDetailSheet
        initialItem={
          selectedSignalId
            ? signalsByPublicId.get(selectedSignalId)
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            void setSelectedSignalId(null);
          }
        }}
        publicId={selectedSignalId}
      />
    </WorkspaceSurface>
  );
}
