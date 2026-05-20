import type { BillingSubscriptionItemResource } from "@vendor/clerk/client/experimental";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";

import { formatDate } from "./billing-utils";

export function ConfirmDowngradeDialog({
  currentPlanName,
  item,
  onConfirm,
  onOpenChange,
}: {
  currentPlanName: string;
  item: BillingSubscriptionItemResource | null;
  onConfirm: (item: BillingSubscriptionItemResource) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const changeDate = formatDate(item?.periodEnd);
  const body = changeDate
    ? `Your current ${currentPlanName} subscription will remain active until ${changeDate}, when it will change to Starter.`
    : `Your current ${currentPlanName} subscription will be scheduled for cancellation.`;

  return (
    <Dialog onOpenChange={onOpenChange} open={!!item}>
      <DialogContent className="p-8 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Confirm plan changes</DialogTitle>
          <DialogDescription className="pt-6 text-xl leading-relaxed">
            {body}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-xl border px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-lg">Starter</p>
              <p className="mt-2 text-muted-foreground">
                Billing will switch to Starter at the end of your current Team
                period.
              </p>
            </div>
            <p className="text-lg">Free</p>
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
          <Button
            className="rounded-full px-7"
            onClick={() => {
              if (item) {
                onConfirm(item);
              }
            }}
            type="button"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
