import type { AppRouterOutputs } from "@api/app";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { toast } from "@repo/ui/components/ui/sonner";
import { skipToken, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useTRPC } from "~/trpc/react";
import { AutomationRunDetailContent } from "./automation-run-detail-content";

type AutomationRun =
  AppRouterOutputs["org"]["workspace"]["automations"]["listRuns"][number];

export function AutomationRunDetailSheet({
  initialRun,
  onOpenChange,
  publicId,
}: {
  initialRun?: AutomationRun;
  onOpenChange: (open: boolean) => void;
  publicId: string | null;
}) {
  const trpc = useTRPC();
  const open = publicId !== null;
  const hasInitial = !!initialRun && initialRun.publicId === publicId;
  const shouldFetchRun = open && !hasInitial && Boolean(publicId);

  const query = useQuery(
    trpc.org.workspace.automations.getRun.queryOptions(
      publicId ? { id: publicId } : skipToken,
      {
        enabled: typeof window !== "undefined" && shouldFetchRun,
        refetchOnWindowFocus: true,
        retry: false,
        staleTime: 5000,
      }
    )
  );

  const run = hasInitial ? initialRun : query.data;

  // Closing on query.isError asks the parent to clear the invalid run search
  // param, which re-renders this sheet with publicId=null and stops recovery.
  useEffect(() => {
    if (publicId && query.isError) {
      onOpenChange(false);
    }
  }, [onOpenChange, publicId, query.isError]);

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
          description: "Anyone with access can open this run.",
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
        showCloseButton={!run}
        side="right"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Run details</SheetTitle>
        </SheetHeader>

        {run ? (
          <AutomationRunDetailContent
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
            onCopyLink={handleCopyLink}
            run={run}
          />
        ) : query.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="font-medium text-foreground text-sm">Run not found</p>
            <p className="text-muted-foreground text-sm">
              It may have been removed or belongs to another organization.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-6" data-testid="run-detail-skeleton">
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
