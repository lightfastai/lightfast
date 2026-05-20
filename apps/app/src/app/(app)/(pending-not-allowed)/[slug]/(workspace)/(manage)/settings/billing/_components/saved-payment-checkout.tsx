import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  useCheckout,
  usePaymentMethods,
} from "@vendor/clerk/client/experimental";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  cardLabel,
  checkoutErrorMessage,
  getDefaultPaymentMethod,
} from "./billing-utils";
import { CheckoutErrors } from "./checkout-errors";
import { LoadingLine } from "./loading-line";

export function SavedPaymentCheckout({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const { checkout, errors, fetchStatus } = useCheckout();
  const paymentMethods = usePaymentMethods({
    for: "organization",
    pageSize: 20,
  });
  const methods = paymentMethods.data ?? [];
  const defaultMethod = useMemo(() => getDefaultPaymentMethod(methods), [methods]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedMethod = methods.find(
    (method) => method.id === (selectedMethodId ?? defaultMethod?.id)
  );

  async function submitSelectedMethod() {
    const paymentMethodId = selectedMethodId ?? defaultMethod?.id;
    if (!paymentMethodId || fetchStatus === "fetching") {
      return;
    }
    setErrorMessage(null);
    const result = await checkout.confirm({ paymentMethodId });
    if (result.error) {
      setErrorMessage(checkoutErrorMessage(result.error));
      return;
    }
    await checkout.finalize({
      navigate: ({ decorateUrl }) => {
        window.location.href = decorateUrl(window.location.pathname);
      },
    });
    onComplete();
  }

  return (
    <div className="space-y-4">
      {paymentMethods.isLoading ? (
        <LoadingLine label="Loading saved cards" />
      ) : methods.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No saved payment methods. Use a new card to continue.
        </p>
      ) : (
        <div className="space-y-2">
          {methods.map((method) => (
            <button
              className={`flex w-full items-center justify-between rounded-md border px-3 py-3 text-left text-sm ${
                selectedMethod?.id === method.id
                  ? "border-foreground"
                  : "border-border/60"
              }`}
              key={method.id}
              onClick={() => setSelectedMethodId(method.id)}
              type="button"
            >
              <span>{cardLabel(method)}</span>
              {method.isDefault && <Badge variant="secondary">Default</Badge>}
            </button>
          ))}
        </div>
      )}
      <CheckoutErrors errorMessage={errorMessage} errors={errors.global} />
      <Button
        disabled={!defaultMethod || fetchStatus === "fetching"}
        onClick={() => void submitSelectedMethod()}
        size="sm"
      >
        {fetchStatus === "fetching" && (
          <Loader2 className="size-4 animate-spin" />
        )}
        Complete Purchase
      </Button>
    </div>
  );
}
