import { Loading03Icon as Loader2 } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { useState } from "react";
import type { ViewSwitcherItem } from "./partition-views";

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
      // Surfaced by the mutation toast; keep the dialog open for retry.
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
              ? `"${view.name}" will be removed from your personal views. This cannot be undone.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={submitting}
            onClick={() => void confirm()}
            type="button"
            variant="destructive"
          >
            {submitting ? (
              <>
                <HugeiconsIcon className="animate-spin" icon={Loader2} />
                Deleting...
              </>
            ) : (
              "Delete view"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
