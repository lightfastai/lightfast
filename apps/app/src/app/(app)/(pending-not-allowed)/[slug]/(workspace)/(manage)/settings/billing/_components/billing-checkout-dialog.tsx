import type { AppRouterOutputs } from "@api/app";
import {
  billingStripeAppearance,
  formatMoney,
  planAmountLabel,
} from "@repo/app-billing";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  CheckoutProvider,
  PaymentElementProvider,
  useCheckout,
} from "@vendor/clerk";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { NewPaymentCheckout } from "./new-payment-checkout";
import { SavedPaymentCheckout } from "./saved-payment-checkout";

type BillingPlan =
  AppRouterOutputs["org"]["settings"]["orgBilling"]["overview"]["plans"][number];

export function BillingCheckoutDialog({
  onComplete,
  onOpenChange,
  open,
  plan,
}: {
  onComplete: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  plan: BillingPlan;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upgrade to Team</DialogTitle>
          <DialogDescription>
            Start the Team plan for {planAmountLabel(plan)}.
          </DialogDescription>
        </DialogHeader>
        <CheckoutProvider
          for="organization"
          planId={plan.id}
          planPeriod="month"
        >
          <CheckoutFlow onComplete={onComplete} />
        </CheckoutProvider>
      </DialogContent>
    </Dialog>
  );
}

function CheckoutFlow({ onComplete }: { onComplete: () => void }) {
  const { checkout, fetchStatus } = useCheckout();
  const [paymentMode, setPaymentMode] = useState("saved");

  if (checkout.status === "needs_initialization") {
    return (
      <div className="rounded-lg border border-border/60 px-4 py-4">
        <p className="text-muted-foreground text-sm">
          Initialize checkout to review totals and payment options.
        </p>
        <Button
          className="mt-4"
          disabled={fetchStatus === "fetching"}
          onClick={() => void checkout.start()}
          size="sm"
        >
          {fetchStatus === "fetching" && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Start checkout
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CheckoutSummary />
      <div className="flex gap-2">
        <Button
          onClick={() => setPaymentMode("saved")}
          size="sm"
          variant={paymentMode === "saved" ? "secondary" : "outline"}
        >
          Use saved card
        </Button>
        <Button
          onClick={() => setPaymentMode("new")}
          size="sm"
          variant={paymentMode === "new" ? "secondary" : "outline"}
        >
          Use new card
        </Button>
      </div>
      {paymentMode === "saved" ? (
        <SavedPaymentCheckout onComplete={onComplete} />
      ) : (
        <PaymentElementProvider
          checkout={checkout}
          // Without `for`, PaymentElementProvider defaults to `for: "user"` and
          // initializes B2C user billing — which is disabled on this instance,
          // so the PaymentElement never gets an externalClientSecret and hangs
          // on its fallback. Org checkout must scope the payment element to the
          // organization, matching the CheckoutProvider above.
          for="organization"
          stripeAppearance={billingStripeAppearance}
        >
          <NewPaymentCheckout onComplete={onComplete} />
        </PaymentElementProvider>
      )}
    </div>
  );
}

function CheckoutSummary() {
  const { checkout, fetchStatus } = useCheckout();
  if (fetchStatus === "fetching") {
    return <LoadingLine label="Loading checkout" />;
  }
  if (!checkout.plan) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/60 px-4 py-4">
      <p className="font-medium text-sm">{checkout.plan.name}</p>
      <p className="mt-1 text-muted-foreground text-sm">
        Due now {formatMoney(checkout.totals.totalDueNow)}
      </p>
    </div>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="h-5 animate-pulse rounded bg-muted/40">
      <span className="sr-only">{label}</span>
    </div>
  );
}
