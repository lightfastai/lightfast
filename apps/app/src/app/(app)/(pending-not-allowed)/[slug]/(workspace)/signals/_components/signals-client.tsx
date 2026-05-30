"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { SignalCreateDialog } from "./signal-create-dialog";
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
import { useSignalsUiStore } from "./signals-ui-store";
import { useSignalsWorkspaceData } from "./use-signals-workspace-data";

export function SignalsClient() {
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
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

  const {
    boardSections,
    classifiedListQueryKey,
    hasAnyRows,
    processingListQueryKey,
    signalsByPublicId,
    visibleListSections,
  } = useSignalsWorkspaceData({
    filters,
    search: "",
  });
  const refreshListQueryKeys = useMemo(
    () => [processingListQueryKey, classifiedListQueryKey],
    [classifiedListQueryKey, processingListQueryKey]
  );

  function openCreateDialog() {
    setCreateDialogOpen(true);
  }

  const emptyCreateAction = (
    <Button
      className="h-8 rounded-full px-3"
      onClick={openCreateDialog}
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

      {view === "board" ? (
        <SignalsBoardView
          emptyAction={emptyCreateAction}
          hasActiveSearch={hasActiveFilters}
          hasAnyRows={hasAnyRows}
          onCreateSignal={openCreateDialog}
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
          onCreateSignal={openCreateDialog}
          onSelectSignal={(publicId) => void setSelectedSignalId(publicId)}
          onToggleGroup={toggleListGroup}
          sections={visibleListSections}
          selectedSignalId={selectedSignalId}
        />
      )}

      <SignalCreateDialog
        listQueryKeys={refreshListQueryKeys}
        onOpenChange={setCreateDialogOpen}
        open={isCreateDialogOpen}
      />

      <SignalDetailSheet
        initialSignal={
          selectedSignalId ? signalsByPublicId.get(selectedSignalId) : undefined
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
