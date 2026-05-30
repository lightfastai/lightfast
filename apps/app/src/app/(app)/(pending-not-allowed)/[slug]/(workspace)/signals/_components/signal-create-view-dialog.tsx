"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { useState } from "react";
import type { SignalViewConfig } from "./signals-views-model";
import { useCreateSignalView } from "./use-signal-views-query";

export function SignalCreateViewDialog({
  config,
  onCreated,
  onOpenChange,
  open,
}: {
  config: SignalViewConfig;
  onCreated: (publicId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [name, setName] = useState("");
  const createView = useCreateSignalView();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed || createView.isPending) {
      return;
    }
    createView.mutate(
      { name: trimmed, config },
      {
        onSuccess: (view) => {
          setName("");
          onOpenChange(false);
          onCreated(view.publicId);
        },
      }
    );
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setName("");
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save view</DialogTitle>
          <DialogDescription>
            Save the current filters and layout as a personal view.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="View name"
          value={name}
        />
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || createView.isPending}
            onClick={submit}
            type="button"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
