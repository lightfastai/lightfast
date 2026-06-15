import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { cn } from "@repo/ui/lib/utils";
import { AlignJustify, Plus, X } from "lucide-react";
import { Fragment, useState } from "react";
import {
  MAX_INLINE_VIEWS,
  partitionViews,
  type ViewSwitcherItem,
} from "./partition-views";
import { ViewCreateDialog } from "./view-create-dialog";
import { ViewDeleteDialog } from "./view-delete-dialog";

export type { ViewSwitcherItem } from "./partition-views";

export interface ViewSwitcherProps {
  activeViewId: string | null;
  onCreate: (name: string) => Promise<unknown>;
  onDelete: (publicId: string) => Promise<unknown>;
  onSelectAll: () => void;
  onSelectView: (publicId: string) => void;
  views: ViewSwitcherItem[];
}

export function ViewSwitcher({
  activeViewId,
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
  const isMobile = useIsMobile();
  const cap = isMobile ? 1 : MAX_INLINE_VIEWS;
  const { overflow, visible } = partitionViews(views, activeViewId, cap);

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <button
            className={cn(
              "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-sm transition-colors",
              activeViewId
                ? "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                : "border-border/70 bg-muted/60 text-foreground"
            )}
            data-active={!activeViewId}
            onClick={onSelectAll}
            type="button"
          >
            <AlignJustify
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
            <span>All</span>
          </button>

          {visible.map((view) => {
            const isActive = activeViewId === view.publicId;
            return (
              <Fragment key={view.publicId}>
                <div
                  aria-hidden="true"
                  className="mx-1.5 h-3.5 w-px shrink-0 bg-border"
                />
                <div
                  className={cn(
                    "group inline-flex h-6 shrink-0 items-center rounded-lg border pr-1 pl-2.5 text-sm transition-colors",
                    isActive
                      ? "border-border/70 bg-muted/60 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  )}
                  data-active={isActive}
                >
                  <button
                    className="inline-flex items-center gap-1.5"
                    onClick={() => onSelectView(view.publicId)}
                    type="button"
                  >
                    <AlignJustify
                      aria-hidden="true"
                      className="size-3.5 rotate-90 text-muted-foreground"
                    />
                    <span className="max-w-[12rem] truncate">{view.name}</span>
                  </button>
                  <button
                    aria-label={`Delete ${view.name}`}
                    className="pointer-events-none pointer-coarse:pointer-events-auto ml-0.5 rounded p-0.5 text-muted-foreground opacity-0 pointer-coarse:opacity-100 transition-opacity hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
                    onClick={() => setPendingDelete(view)}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-3" />
                  </button>
                </div>
              </Fragment>
            );
          })}

          {overflow.length > 0 ? (
            <>
              <div
                aria-hidden="true"
                className="mx-1.5 h-3.5 w-px shrink-0 bg-border"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="More views"
                    className="inline-flex h-6 shrink-0 items-center justify-center rounded-full px-2.5 text-muted-foreground text-sm transition-colors hover:bg-muted/60 hover:text-foreground"
                    type="button"
                  >
                    +{overflow.length}
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
                      <AlignJustify
                        aria-hidden="true"
                        className="size-3.5 rotate-90 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {view.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>

        <Button
          aria-label="New view"
          className="size-6 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          onClick={() => setCreateOpen(true)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </Button>
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
