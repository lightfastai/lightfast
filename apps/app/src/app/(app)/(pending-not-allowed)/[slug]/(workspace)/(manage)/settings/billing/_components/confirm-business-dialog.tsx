import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";

import { businessContact } from "./billing-utils";

export function ConfirmBusinessDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="p-8 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Confirm plan changes</DialogTitle>
          <DialogDescription className="pt-6 text-xl leading-relaxed">
            We will open an email to sales@lightfast.ai to continue the
            Business plan conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-xl border px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-lg">Business</p>
              <p className="mt-2 text-muted-foreground">
                We will open an email to continue the Business plan
                conversation.
              </p>
            </div>
            <p className="text-lg">Contact sales</p>
          </div>
        </div>
        <DialogFooter className="mt-8">
          <Button
            className="rounded-full px-7"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button asChild className="rounded-full px-7">
            <a href={businessContact.href}>Confirm</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
