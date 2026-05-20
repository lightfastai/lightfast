import type { BillingPlanResource } from "@vendor/clerk/client/experimental";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";

import { planAmountLabel } from "./billing-utils";

export function ConfirmUpgradeDialog({
  onConfirm,
  onOpenChange,
  plan,
}: {
  onConfirm: (plan: BillingPlanResource) => void;
  onOpenChange: (open: boolean) => void;
  plan: BillingPlanResource | null;
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
