import {
  Add01Icon,
  Cancel01Icon,
  ListViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { Button } from "@repo/ui-v2/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
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
          <Button
            data-active={!activeViewId}
            onClick={onSelectAll}
            size="xs"
            type="button"
            variant={activeViewId ? "ghost" : "secondary"}
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={ListViewIcon}
            />
            <span>All</span>
          </Button>

          {visible.map((view) => {
            const isActive = activeViewId === view.publicId;
            return (
              <Fragment key={view.publicId}>
                <div
                  aria-hidden="true"
                  className="mx-1.5 h-3.5 w-px shrink-0 bg-border"
                />
                <div className="inline-flex shrink-0 items-center gap-0.5">
                  <Button
                    data-active={isActive}
                    onClick={() => onSelectView(view.publicId)}
                    size="xs"
                    type="button"
                    variant={isActive ? "secondary" : "ghost"}
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      data-icon="inline-start"
                      icon={ListViewIcon}
                    />
                    <span className="max-w-[12rem] truncate">{view.name}</span>
                  </Button>
                  <Button
                    aria-label={`Delete ${view.name}`}
                    onClick={() => setPendingDelete(view)}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} />
                  </Button>
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
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label="More views"
                      size="xs"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  +{overflow.length}
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
                      onClick={() => onSelectView(view.publicId)}
                    >
                      <HugeiconsIcon aria-hidden="true" icon={ListViewIcon} />
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
          onClick={() => setCreateOpen(true)}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden="true" icon={Add01Icon} />
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
