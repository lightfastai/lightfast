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
import type { PeopleViewConfig } from "./people-views-model";
import { useCreatePeopleView } from "./use-people-views-query";

export function PeopleCreateViewDialog({
  config,
  onCreated,
  onOpenChange,
  open,
}: {
  config: PeopleViewConfig;
  onCreated: (publicId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [name, setName] = useState("");
  const createView = useCreatePeopleView();

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
            Save the current filters as a personal view.
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
