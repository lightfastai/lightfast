"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface CreateDialogShellProps {
  busy?: boolean;
  children: ReactNode;
  description: string;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  org: { initials: string; name: string } | null;
  title: string;
}

export function CreateDialogShell({
  busy = false,
  children,
  description,
  footerLeft,
  footerRight,
  onOpenChange,
  open,
  org,
  title,
}: CreateDialogShellProps) {
  function handleOpenChange(nextOpen: boolean) {
    if (busy && !nextOpen) {
      return;
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-[12px] border-border bg-card p-0 shadow-2xl sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogDescription className="sr-only">{description}</DialogDescription>

        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Avatar className="size-5">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {org?.initials ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium">
              {org?.name ?? "Workspace"}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              ›
            </span>
            <DialogTitle className="truncate font-medium text-sm">
              {title}
            </DialogTitle>
          </div>

          <DialogClose asChild>
            <Button
              aria-label="Close"
              className="size-7 rounded-md text-muted-foreground hover:text-foreground"
              disabled={busy}
              onClick={() => onOpenChange(false)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </DialogClose>
        </div>

        {children}

        <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-4">
          <div className="min-w-0">{footerLeft}</div>
          <div className="flex items-center gap-3">{footerRight}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
