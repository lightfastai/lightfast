"use client";

import { cn } from "@repo/ui/lib/utils";
import { Plus, Users, X } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { PeopleCreateViewDialog } from "./people-create-view-dialog";
import {
  parsePersonProviders,
  parsePersonTypes,
  peopleSavedViewParser,
  personProviderParser,
  personTypeParser,
} from "./people-search-params";
import {
  ALL_PEOPLE_VIEW_NAME,
  allPeopleParamValues,
  type PeopleViewParamValues,
  selectionToConfig,
  viewConfigToParamValues,
} from "./people-views-model";
import {
  useDeletePeopleView,
  usePeopleViewsQuery,
} from "./use-people-views-query";

/**
 * Views bar — every view is an always-visible pill (no dropdown). "All people"
 * is synthetic (active when `?view` is absent); each saved view is a pill that
 * stamps its filters into the URL when clicked. The trailing `+` saves the
 * current selection as a new view.
 *
 * The bar coordinates with the page entirely through URL params (nuqs): the
 * three params are written in a single `setParams` call so selecting a view is
 * one history entry / one re-render.
 */
export function PeopleViewSwitcher() {
  const [params, setParams] = useQueryStates({
    provider: personProviderParser,
    type: personTypeParser,
    view: peopleSavedViewParser,
  });
  const [isCreateOpen, setCreateOpen] = useState(false);

  const viewsQuery = usePeopleViewsQuery();
  const deleteView = useDeletePeopleView();
  const views = viewsQuery.data ?? [];
  const savedViewId = params.view;

  // With many views the row scrolls horizontally; keep the active pill visible.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [savedViewId, views.length]);

  // Cheap pure transform — recompute each render. Snapshots the current
  // selection so `+` can save it as a view.
  const currentConfig = selectionToConfig({
    providers: parsePersonProviders(params.provider),
    types: parsePersonTypes(params.type),
  });

  function applyParams(next: PeopleViewParamValues, viewId: string | null) {
    void setParams({
      provider: next.provider,
      type: next.type,
      view: viewId,
    });
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {/* Scrollable pill region. The `+` stays pinned outside so it is always
            reachable even when the views overflow. */}
        <div
          className="flex min-w-0 items-center gap-1 overflow-x-auto"
          ref={scrollRef}
        >
          <button
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-sm transition-colors",
              savedViewId
                ? "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                : "border-border/70 bg-muted/60 text-foreground"
            )}
            data-active={!savedViewId}
            onClick={() => applyParams(allPeopleParamValues(), null)}
            type="button"
          >
            <Users
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
            <span>{ALL_PEOPLE_VIEW_NAME}</span>
          </button>

          {views.map((view) => {
            const isActive = savedViewId === view.publicId;
            return (
              <div
                className={cn(
                  "group inline-flex h-7 shrink-0 items-center rounded-lg border pr-1 pl-2.5 text-sm transition-colors",
                  isActive
                    ? "border-border/70 bg-muted/60 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
                data-active={isActive}
                key={view.publicId}
              >
                <button
                  className="inline-flex items-center gap-1.5"
                  onClick={() =>
                    applyParams(
                      viewConfigToParamValues(view.config),
                      view.publicId
                    )
                  }
                  type="button"
                >
                  <Users
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground"
                  />
                  <span className="max-w-[12rem] truncate">{view.name}</span>
                </button>
                <button
                  aria-label={`Delete ${view.name}`}
                  className="ml-0.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  onClick={() =>
                    deleteView.mutate(
                      { publicId: view.publicId },
                      {
                        onSuccess: () => {
                          if (savedViewId === view.publicId) {
                            void setParams({ view: null });
                          }
                        },
                      }
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          aria-label="New view"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          onClick={() => setCreateOpen(true)}
          type="button"
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      <PeopleCreateViewDialog
        config={currentConfig}
        onCreated={(publicId) => void setParams({ view: publicId })}
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />
    </>
  );
}
