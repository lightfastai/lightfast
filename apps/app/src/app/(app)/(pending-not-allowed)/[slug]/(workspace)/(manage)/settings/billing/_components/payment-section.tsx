import type { BillingPaymentMethodResource } from "@vendor/clerk/client/experimental";
import { Button } from "@repo/ui/components/ui/button";
import { CreditCard } from "lucide-react";

import { cardLabel } from "./billing-utils";

export function PaymentSection({
  defaultPaymentMethod,
  isAdmin,
  isLoading,
  onUpdate,
}: {
  defaultPaymentMethod: BillingPaymentMethodResource | null;
  isAdmin: boolean;
  isLoading: boolean;
  onUpdate: () => void;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <h3 className="font-semibold text-foreground text-lg">Payment</h3>
        <div className="mt-5 flex items-center gap-3 text-sm">
          <CreditCard className="size-4 text-muted-foreground" />
          {isLoading ? (
            <span className="text-muted-foreground">
              Loading payment method
            </span>
          ) : (
            <span>{cardLabel(defaultPaymentMethod)}</span>
          )}
        </div>
      </div>
      {isAdmin && (
        <Button onClick={onUpdate} size="sm" variant="secondary">
          Update
        </Button>
      )}
    </section>
  );
}
