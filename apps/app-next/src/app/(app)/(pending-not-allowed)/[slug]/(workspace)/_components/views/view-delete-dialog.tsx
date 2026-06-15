"use client";

import {
  Dialog,
  DialogActionButton,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { ViewSwitcherItem } from "./partition-views";

/**
 * Confirm before deleting a saved view. Open while `view` is non-null. Mirrors
 * the invite-member action-dialog (full-bleed split buttons); confirm uses the
 * destructive variant. The parent performs the delete inside `onConfirm`.
 */
export function ViewDeleteDialog({
  onConfirm,
  onOpenChange,
  view,
}: {
  onConfirm: (publicId: string) => Promise<unknown>;
  onOpenChange: (open: boolean) => void;
  view: ViewSwitcherItem | null;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!view || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(view.publicId);
      onOpenChange(false);
    } catch {
      // Surfaced upstream; keep open for a retry.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={view !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete view</DialogTitle>
          <DialogDescription>
            {view
              ? `“${view.name}” will be removed from your personal views. This can’t be undone.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogActions>
          <DialogClose asChild>
            <DialogActionButton>Cancel</DialogActionButton>
          </DialogClose>
          <DialogActionButton
            disabled={submitting}
            onClick={() => void confirm()}
            variant="destructive"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete view"
            )}
          </DialogActionButton>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
