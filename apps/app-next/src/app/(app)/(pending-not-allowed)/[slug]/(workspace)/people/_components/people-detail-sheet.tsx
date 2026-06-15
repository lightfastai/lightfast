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
import { useCallback, useRef } from "react";
import { useTRPC } from "~/trpc/react";
import { PeopleDetailContent } from "./people-detail-content";
import { getPersonName, type PersonRow } from "./people-model";

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
  const trpc = useTRPC();
  const open = publicId !== null;
  const skipNextCloseRef = useRef(false);
  const hasInitial = !!initialPerson && initialPerson.publicId === publicId;

  const query = useQuery(
    trpc.org.workspace.people.get.queryOptions(
      { publicId: publicId ?? "" },
      { enabled: open && !hasInitial && Boolean(publicId) }
    )
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

  const handleNavigateAway = useCallback(() => {
    skipNextCloseRef.current = true;
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && skipNextCloseRef.current) {
        skipNextCloseRef.current = false;
        return;
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetContent
        className="inset-y-3 right-3 left-auto h-auto w-full max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-2xl border p-0 sm:max-w-md"
        showCloseButton={!person}
        side="right"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>
            {person ? getPersonName(person) : "Person details"}
          </SheetTitle>
          <SheetDescription>
            Person details, identity, and related signals.
          </SheetDescription>
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
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </SheetClose>
            }
            onCopyLink={handleCopyLink}
            onNavigateAway={handleNavigateAway}
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
