import type { AppRouterOutputs } from "@api/app";
import { businessContact, planAmountLabel } from "@repo/app-billing";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { formatUtcCalendarDate as formatDate } from "@vendor/lib/time";
import {
  Tick02Icon as Check,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type BillingOverview =
  AppRouterOutputs["org"]["settings"]["orgBilling"]["overview"];
type BillingPlan = BillingOverview["plans"][number];
type BillingSubscriptionItem =
  BillingOverview["subscription"]["subscriptionItems"][number];

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
      <DialogContent className="p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-medium text-xl">
            Confirm plan changes
          </DialogTitle>
          <DialogDescription className="pt-3 text-base leading-relaxed">
            {body}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col rounded-sm border border-transparent bg-card p-5 text-card-foreground">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-foreground">Starter</h3>
            <p className="text-base text-muted-foreground">
              Try Lightfast with your team.
            </p>
          </div>
          <div className="mt-4 flex-1 space-y-2">
            <div className="flex items-start gap-3">
              <HugeiconsIcon icon={Check} className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
              <span className="text-foreground text-sm">
                Free organization workspace
              </span>
            </div>
            <div className="flex items-start gap-3">
              <HugeiconsIcon icon={Check} className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
              <span className="text-foreground text-sm">
                Billing changes at the end of your current Team period
              </span>
            </div>
          </div>
          <div className="mt-8">
            <span className="font-bold text-3xl text-foreground">Free</span>
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
      <DialogContent className="p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-medium text-xl">
            Confirm plan changes
          </DialogTitle>
          <DialogDescription className="pt-3 text-base leading-relaxed">
            Your organization will move to Team after checkout is complete.
          </DialogDescription>
        </DialogHeader>
        {plan && (
          <div className="mt-4 flex flex-col rounded-sm border border-foreground bg-card p-5 text-card-foreground shadow-lg">
            <div className="space-y-1">
              <h3 className="font-bold text-base text-foreground">
                {plan.name}
              </h3>
              <p className="text-base text-muted-foreground">
                Everything you need to scale.
              </p>
            </div>
            <div className="mt-4 flex-1 space-y-2">
              <div className="flex items-start gap-3">
                <HugeiconsIcon icon={Check} className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
                <span className="text-foreground text-sm">
                  Team workspace billing
                </span>
              </div>
              <div className="flex items-start gap-3">
                <HugeiconsIcon icon={Check} className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
                <span className="text-foreground text-sm">
                  Billing starts after checkout is complete
                </span>
              </div>
            </div>
            <div className="mt-8">
              <span className="font-bold text-3xl text-foreground">
                {planAmountLabel(plan)}
              </span>
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
      <DialogContent className="p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-medium text-xl">
            Confirm plan changes
          </DialogTitle>
          <DialogDescription className="pt-3 text-base leading-relaxed">
            We will open an email to sales@lightfast.ai to continue the Business
            plan conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col rounded-sm border border-transparent bg-card p-5 text-card-foreground">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-foreground">Business</h3>
            <p className="text-base text-muted-foreground">
              Sales-led onboarding for larger teams.
            </p>
          </div>
          <div className="mt-4 flex-1 space-y-2">
            <div className="flex items-start gap-3">
              <HugeiconsIcon icon={Check} className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
              <span className="text-foreground text-sm">
                We will open an email to continue the Business conversation
              </span>
            </div>
            <div className="flex items-start gap-3">
              <HugeiconsIcon icon={Check} className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
              <span className="text-foreground text-sm">
                Custom pricing and onboarding
              </span>
            </div>
          </div>
          <div className="mt-8">
            <span className="font-bold text-3xl text-foreground">Custom</span>
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
