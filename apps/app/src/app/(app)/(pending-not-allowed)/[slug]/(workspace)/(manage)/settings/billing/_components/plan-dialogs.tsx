import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";

import type { BillingPlan, BillingSubscriptionItem } from "./billing-utils";
import { businessContact, formatDate, planAmountLabel } from "./billing-utils";

export function ConfirmDowngradeDialog({
  currentPlanName,
  item,
  onConfirm,
  onOpenChange,
}: {
  currentPlanName: string;
  item: BillingSubscriptionItem | null;
  onConfirm: (item: BillingSubscriptionItem) => void;
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

export function ConfirmUpgradeDialog({
  onConfirm,
  onOpenChange,
  plan,
}: {
  onConfirm: (plan: BillingPlan) => void;
  onOpenChange: (open: boolean) => void;
  plan: BillingPlan | null;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={!!plan}>
      <DialogContent className="p-8 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Confirm plan changes</DialogTitle>
          <DialogDescription className="pt-6 text-xl leading-relaxed">
            Your organization will move to Team after checkout is complete.
          </DialogDescription>
        </DialogHeader>
        {plan && (
          <div className="mt-4 rounded-xl border px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-lg">{plan.name}</p>
                <p className="mt-2 text-muted-foreground">
                  Billing will start after checkout is complete.
                </p>
              </div>
              <p className="text-lg">{planAmountLabel(plan)}</p>
            </div>
          </div>
        )}
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
              if (plan) {
                onConfirm(plan);
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
