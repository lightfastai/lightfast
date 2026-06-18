import { Cancel01Icon as X } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { toast } from "@repo/ui/components/ui/sonner";
import { ConnectorDetailContent } from "./connector-detail-content";
import type { ConnectorCatalogRow } from "./connectors-model";

export function ConnectorDetailSheet({
  onOpenChange,
  row,
}: {
  onOpenChange: (open: boolean) => void;
  row?: ConnectorCatalogRow;
}) {
  const open = Boolean(row?.connection);

  function handleCopyLink() {
    if (typeof window === "undefined") {
      return;
    }
    const clipboard = navigator.clipboard;
    if (!clipboard) {
      toast.error("Unable to copy link");
      return;
    }
    void clipboard
      .writeText(window.location.href)
      .then(() => {
        toast.success("Link copied", {
          description: "Anyone with access can open this connector.",
        });
      })
      .catch(() => {
        toast.error("Unable to copy link");
      });
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="inset-y-3 right-3 left-auto h-auto w-full max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-2xl border p-0 sm:max-w-md"
        showCloseButton={!row}
        side="right"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{row ? row.displayName : "Connector details"}</SheetTitle>
          <SheetDescription>
            {row?.description ?? "Connector identity, status, and tools."}
          </SheetDescription>
        </SheetHeader>

        {row?.connection ? (
          <ConnectorDetailContent
            closeSlot={
              <SheetClose asChild>
                <Button
                  aria-label="Close"
                  className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="size-4"
                    icon={X}
                  />
                </Button>
              </SheetClose>
            }
            onCopyLink={handleCopyLink}
            row={row}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
