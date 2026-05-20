import type {
  BillingMoneyAmount,
  BillingSubscriptionResource,
} from "@vendor/clerk/client/experimental";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";

import { formatDate, formatMoney, statusLabel } from "./billing-utils";

export function PlanSection({
  currentAmount,
  currentPlanName,
  currentTier,
  isAdmin,
  nextPayment,
  onAdjustPlan,
  status,
}: {
  currentAmount: BillingMoneyAmount | null;
  currentPlanName: string;
  currentTier: "starter" | "team" | null;
  isAdmin: boolean;
  nextPayment: BillingSubscriptionResource["nextPayment"] | null;
  onAdjustPlan: () => void;
  status: BillingSubscriptionResource["status"] | "active";
}) {
  const nextPaymentDate = formatDate(nextPayment?.date);
  const renewalCopy =
    currentTier === "team" && nextPaymentDate
      ? `Your subscription will auto renew on ${nextPaymentDate}.`
      : "Your organization is on the free Starter plan.";

  return (
    <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{currentPlanName}</p>
          <Badge className="capitalize" variant="secondary">
            {statusLabel(status)}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          {currentAmount ? `${formatMoney(currentAmount)}/month` : "Free"}
        </p>
        <p className="mt-1 text-muted-foreground text-sm">{renewalCopy}</p>
      </div>
      {isAdmin && (
        <Button onClick={onAdjustPlan} size="sm" variant="secondary">
          Adjust plan
        </Button>
      )}
    </section>
  );
}
