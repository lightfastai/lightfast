"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, type LucideIcon, Plus, X } from "lucide-react";
import { useState } from "react";
import { partitionViews, type ViewSwitcherItem } from "./partition-views";
import { ViewCreateDialog } from "./view-create-dialog";
import { ViewDeleteDialog } from "./view-delete-dialog";

export type { ViewSwitcherItem } from "./partition-views";

export interface ViewSwitcherProps {
  activeViewId: string | null;
  allLabel: string;
  icon: LucideIcon;
  onCreate: (name: string) => Promise<unknown>;
  onDelete: (publicId: string) => Promise<unknown>;
  onSelectAll: () => void;
  onSelectView: (publicId: string) => void;
  views: ViewSwitcherItem[];
}

/**
 * Shared views bar for Signals and People. "All" is synthetic (active when no
 * saved view). Saved views render as pills up to MAX_INLINE_VIEWS; the rest
 * collapse into a "+N" dropdown. The active view is always promoted into the
 * inline pills (partitionViews), so it is never hidden — the overflow rows are
 * therefore select-only, and deletion always happens from a pill. Create/delete
 * go through confirm dialogs.
 *
 * Entity specifics (icon, label, param wiring, mutations) are injected by thin
 * per-entity wrappers — this component knows nothing about signals vs people.
 */
export function ViewSwitcher({
  activeViewId,
  allLabel,
  icon: Icon,
  onCreate,
  onDelete,
  onSelectAll,
  onSelectView,
  views,
}: ViewSwitcherProps) {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ViewSwitcherItem | null>(
    null
  );

  const { overflow, visible } = partitionViews(views, activeViewId);

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <button
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-sm transition-colors",
              activeViewId
                ? "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                : "border-border/70 bg-muted/60 text-foreground"
            )}
            data-active={!activeViewId}
            onClick={onSelectAll}
            type="button"
          >
            <Icon
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
            <span>{allLabel}</span>
          </button>

          {visible.map((view) => {
            const isActive = activeViewId === view.publicId;
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
                  onClick={() => onSelectView(view.publicId)}
                  type="button"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground"
                  />
                  <span className="max-w-[12rem] truncate">{view.name}</span>
                </button>
                <button
                  aria-label={`Delete ${view.name}`}
                  className="ml-0.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  onClick={() => setPendingDelete(view)}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </div>
            );
          })}

          {overflow.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="More views"
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-transparent px-2.5 text-muted-foreground text-sm transition-colors hover:bg-muted/30 hover:text-foreground"
                  type="button"
                >
                  +{overflow.length}
                  <ChevronDown aria-hidden="true" className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-60"
                sideOffset={8}
              >
                {overflow.map((view) => (
                  <DropdownMenuItem
                    className="gap-2"
                    key={view.publicId}
                    onSelect={() => onSelectView(view.publicId)}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate">{view.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
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

      <ViewCreateDialog
        onOpenChange={setCreateOpen}
        onSubmit={onCreate}
        open={isCreateOpen}
      />
      <ViewDeleteDialog
        onConfirm={onDelete}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        view={pendingDelete}
      />
    </>
  );
}
