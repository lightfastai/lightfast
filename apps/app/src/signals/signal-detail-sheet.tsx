import { getSignal } from "@api/app/tanstack/signals";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "@repo/ui/components/ui/sonner";
import { Button } from "@repo/ui-v2/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui-v2/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { SignalDetailContent } from "./signal-detail-content";
import { signalQueryKeys } from "./signals-cache";
import {
  getSignalSummary,
  getSignalTitle,
  type SignalDetailRow,
  type SignalListItem,
  type SignalRow,
} from "./signals-model";

function copySignalLink() {
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

export function SignalDetailSheet({
  initialItem,
  onOpenChange,
  publicId,
}: {
  initialItem?: SignalListItem | SignalRow;
  onOpenChange: (open: boolean) => void;
  publicId: string | null;
}) {
  const open = publicId !== null;
  const seededItem =
    initialItem && initialItem.publicId === publicId ? initialItem : undefined;
  // Processing rows (and any already-fetched full rows) carry `input`, so their
  // body needs no `get`. Classified projection rows do.
  const hasBody = !!seededItem && "input" in seededItem;
  const detailPublicId = publicId ?? "";
  const shouldFetchDetail = open && !hasBody && detailPublicId.length > 0;

  const {
    data: fetchedDetail,
    isError,
    isLoading,
  } = useQuery({
    enabled: typeof window !== "undefined" && shouldFetchDetail,
    queryFn: () => getSignal({ data: { publicId: detailPublicId } }),
    queryKey: signalQueryKeys.detail(detailPublicId),
  });

  // Header seed: the projection (or, for deep-links not in cache, the fetched row).
  const headerItem: SignalListItem | undefined = seededItem ?? fetchedDetail;
  // Body: the full row if seeded, else the fetched row.
  const detail: SignalDetailRow | undefined = hasBody
    ? ({
        ...(seededItem as SignalRow),
        entityLinks: [],
      } as SignalDetailRow)
    : fetchedDetail;
  const bodyLoading = !detail && isLoading;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent showCloseButton={!headerItem} side="right">
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
              <SheetClose
                render={
                  <Button
                    aria-label="Close"
                    size="icon-sm"
                    title="Close"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} />
              </SheetClose>
            }
            detail={detail}
            item={headerItem}
            onCopyLink={copySignalLink}
          />
        ) : isError ? (
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
