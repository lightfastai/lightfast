"use client";

import { RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";

interface LandscapePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LandscapePromptModal({
  open,
  onOpenChange,
}: LandscapePromptModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <RotateCcw className="h-6 w-6 text-muted-foreground animate-pulse" />
          </div>
          <DialogTitle>Rotate for Full Screen</DialogTitle>
          <DialogDescription className="text-center">
            Turn your device to landscape orientation for the best viewing experience.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Continue in Portrait
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
