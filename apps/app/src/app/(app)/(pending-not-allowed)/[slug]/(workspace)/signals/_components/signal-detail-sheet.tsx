"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { toast } from "@repo/ui/components/ui/sonner";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { SignalDetailContent } from "./signal-detail-content";
import { getSignalTitle, type SignalRow } from "./signals-model";

export function SignalDetailSheet({
  initialSignal,
  onOpenChange,
  publicId,
}: {
  initialSignal?: SignalRow;
  onOpenChange: (open: boolean) => void;
  publicId: string | null;
}) {
  const trpc = useTRPC();
  const open = publicId !== null;
  const hasInitial = !!initialSignal && initialSignal.publicId === publicId;

  const query = useQuery(
    trpc.org.workspace.signals.get.queryOptions(
      { publicId: publicId ?? "" },
      { enabled: open && !hasInitial && Boolean(publicId) }
    )
  );

  const signal = hasInitial ? initialSignal : query.data;

  function handleCopyLink() {
    if (typeof window === "undefined") {
      return;
    }
    void navigator.clipboard?.writeText(window.location.href);
    toast.success("Link copied", {
      description: "Anyone with access can open this signal.",
    });
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="sr-only">
          <SheetTitle>
            {signal ? getSignalTitle(signal) : "Signal details"}
          </SheetTitle>
        </SheetHeader>

        {signal ? (
          <SignalDetailContent onCopyLink={handleCopyLink} signal={signal} />
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
