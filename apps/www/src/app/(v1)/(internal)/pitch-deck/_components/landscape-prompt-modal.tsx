"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { RotateCcw } from "lucide-react";

interface LandscapePromptModalProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function LandscapePromptModal({
  open,
  onOpenChange,
}: LandscapePromptModalProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <RotateCcw className="h-6 w-6 animate-pulse text-muted-foreground" />
          </div>
          <DialogTitle>Rotate for Full Screen</DialogTitle>
          <DialogDescription className="text-center">
            Turn your device to landscape orientation for the best viewing
            experience.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-4">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Continue in Portrait
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
