import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { toast } from "@repo/ui/components/ui/sonner";
import { useQuery } from "@tanstack/react-query";
import {
  Cancel01Icon as X,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PeopleDetailContent } from "./people-detail-content";
import { getPersonName, type PersonRow } from "./people-model";
import { personDetailQueryOptions } from "./people-queries";

export function PeopleDetailSheet({
  initialPerson,
  onOpenChange,
  publicId,
  slug,
}: {
  initialPerson?: PersonRow;
  onOpenChange: (open: boolean) => void;
  publicId: string | null;
  slug: string;
}) {
  const open = publicId !== null;
  const hasInitial = !!initialPerson && initialPerson.publicId === publicId;

  const query = useQuery(
    personDetailQueryOptions({
      enabled: open && !hasInitial && Boolean(publicId),
      publicId: publicId ?? "",
    })
  );

  const person = hasInitial ? initialPerson : query.data;

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
          description: "Anyone with access can open this person.",
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
        showCloseButton={!person}
        side="right"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>
            {person ? getPersonName(person) : "Person details"}
          </SheetTitle>
        </SheetHeader>

        {person ? (
          <PeopleDetailContent
            closeSlot={
              <SheetClose asChild>
                <Button
                  aria-label="Close"
                  className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <HugeiconsIcon icon={X} aria-hidden="true" className="size-4" />
                </Button>
              </SheetClose>
            }
            onCopyLink={handleCopyLink}
            person={person}
            slug={slug}
          />
        ) : query.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="font-medium text-foreground text-sm">
              Person not found
            </p>
            <p className="text-muted-foreground text-sm">
              It may have been removed or belongs to another organization.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-6" data-testid="person-detail-skeleton">
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
