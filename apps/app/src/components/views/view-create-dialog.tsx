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
import { Input } from "@repo/ui/components/ui/input";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export function ViewCreateDialog({
  onOpenChange,
  onSubmit,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<unknown>;
  open: boolean;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setName("");
      onOpenChange(false);
    } catch {
      // Surfaced by the mutation toast; keep the dialog open for retry.
    } finally {
      setSubmitting(false);
    }
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
              void submit();
            }
          }}
          placeholder="View name"
          value={name}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={!name.trim() || submitting}
            onClick={() => void submit()}
            type="button"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Saving...
              </>
            ) : (
              "Save view"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
