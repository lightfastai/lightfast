"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { SignalCreateViewDialog } from "./signal-create-view-dialog";
import {
  parseSignalDispositions,
  parseSignalKinds,
  parseSignalPriorities,
  signalDispositionParser,
  signalKindParser,
  signalLayoutParser,
  signalPeopleParser,
  signalPriorityParser,
  signalSavedViewParser,
} from "./signals-search-params";
import {
  ALL_SIGNALS_VIEW_NAME,
  allSignalsParamValues,
  type SignalViewParamValues,
  selectionToConfig,
  viewConfigToParamValues,
} from "./signals-views-model";
import {
  useDeleteSignalView,
  useSignalViewsQuery,
} from "./use-signal-views-query";

export function SignalsViewSwitcher() {
  const [dispositionState, setDispositionState] = useQueryState(
    "disposition",
    signalDispositionParser
  );
  const [kindState, setKindState] = useQueryState("kind", signalKindParser);
  const [priorityState, setPriorityState] = useQueryState(
    "priority",
    signalPriorityParser
  );
  const [peopleState, setPeopleState] = useQueryState(
    "people",
    signalPeopleParser
  );
  const [layout, setLayout] = useQueryState("layout", signalLayoutParser);
  const [savedViewId, setSavedViewId] = useQueryState(
    "view",
    signalSavedViewParser
  );
  const [isCreateOpen, setCreateOpen] = useState(false);

  const viewsQuery = useSignalViewsQuery();
  const deleteView = useDeleteSignalView();
  const views = viewsQuery.data ?? [];
  const activeView = views.find((view) => view.publicId === savedViewId);
  const activeLabel = activeView?.name ?? ALL_SIGNALS_VIEW_NAME;

  // Cheap pure transform — recompute each render rather than memoize.
  const currentConfig = selectionToConfig(
    {
      dispositions: parseSignalDispositions(dispositionState),
      kinds: parseSignalKinds(kindState),
      peopleRouted: peopleState === "routed",
      priorities: parseSignalPriorities(priorityState),
    },
    layout
  );

  function applyParams(next: SignalViewParamValues, viewId: string | null) {
    void setDispositionState(next.disposition);
    void setKindState(next.kind);
    void setPriorityState(next.priority);
    void setPeopleState(next.people);
    void setLayout(next.layout);
    void setSavedViewId(viewId);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="h-7 gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-2.5 font-normal text-foreground text-sm hover:bg-muted/60"
            size="sm"
            type="button"
            variant="ghost"
          >
            {activeLabel}
            <ChevronDown
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => applyParams(allSignalsParamValues(layout), null)}
          >
            <span className="flex-1">{ALL_SIGNALS_VIEW_NAME}</span>
            {savedViewId ? null : (
              <Check
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
            )}
          </DropdownMenuItem>

          {views.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Your views
              </DropdownMenuLabel>
              {views.map((view) => (
                <DropdownMenuItem
                  className="gap-2"
                  key={view.publicId}
                  onClick={() =>
                    applyParams(
                      viewConfigToParamValues(view.config),
                      view.publicId
                    )
                  }
                >
                  <span className="min-w-0 flex-1 truncate">{view.name}</span>
                  {savedViewId === view.publicId ? (
                    <Check
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground"
                    />
                  ) : null}
                  <button
                    aria-label={`Delete ${view.name}`}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteView.mutate(
                        { publicId: view.publicId },
                        {
                          onSuccess: () => {
                            if (savedViewId === view.publicId) {
                              void setSavedViewId(null);
                            }
                          },
                        }
                      );
                    }}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-3.5" />
            <span>New view</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignalCreateViewDialog
        config={currentConfig}
        onCreated={(publicId) => void setSavedViewId(publicId)}
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />
    </>
  );
}
