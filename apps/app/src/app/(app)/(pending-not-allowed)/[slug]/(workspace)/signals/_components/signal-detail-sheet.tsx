"use client";

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
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { SignalDetailContent } from "./signal-detail-content";
import {
  getSignalSummary,
  getSignalTitle,
  type SignalDetailRow,
  type SignalListItem,
  type SignalRow,
} from "./signals-model";

export function SignalDetailSheet({
  initialItem,
  onOpenChange,
  publicId,
  slug,
}: {
  initialItem?: SignalListItem | SignalRow;
  onOpenChange: (open: boolean) => void;
  publicId: string | null;
  slug: string;
}) {
  const trpc = useTRPC();
  const open = publicId !== null;
  const seededItem =
    initialItem && initialItem.publicId === publicId ? initialItem : undefined;
  // Processing rows (and any already-fetched full rows) carry `input`, so their
  // body needs no `get`. Classified projection rows do.
  const hasBody = !!seededItem && "input" in seededItem;

  const query = useQuery(
    trpc.org.workspace.signals.get.queryOptions(
      { publicId: publicId ?? "" },
      { enabled: open && !hasBody && Boolean(publicId) }
    )
  );

  // Header seed: the projection (or, for deep-links not in cache, the fetched row).
  const headerItem: SignalListItem | undefined = seededItem ?? query.data;
  // Body: the full row if seeded, else the fetched row.
  const detail: SignalDetailRow | undefined = hasBody
    ? ({
        ...(seededItem as SignalRow),
        entityLinks: [],
      } as SignalDetailRow)
    : query.data;
  const bodyLoading = !detail && query.isLoading;

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
          description: "Anyone with access can open this signal.",
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
        showCloseButton={!headerItem}
        side="right"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>
            {headerItem ? getSignalTitle(headerItem) : "Signal details"}
          </SheetTitle>
          <SheetDescription>
            {(headerItem && getSignalSummary(headerItem)) ||
              "Signal details, classification, and source."}
          </SheetDescription>
        </SheetHeader>

        {headerItem ? (
          <SignalDetailContent
            bodyLoading={bodyLoading}
            closeSlot={
              <SheetClose asChild>
                <Button
                  aria-label="Close"
                  className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </SheetClose>
            }
            detail={detail}
            item={headerItem}
            onCopyLink={handleCopyLink}
            slug={slug}
          />
        ) : query.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="font-medium text-foreground text-sm">
              Signal not found
            </p>
            <p className="text-muted-foreground text-sm">
              It may have been deleted or belongs to another organization.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-6" data-testid="signal-detail-skeleton">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-7 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
