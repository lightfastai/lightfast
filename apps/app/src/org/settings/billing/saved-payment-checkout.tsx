import {
  cardLabel,
  checkoutErrorMessage,
  getDefaultPaymentMethod,
} from "@repo/app-billing";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import type { CheckoutErrors as ClerkCheckoutErrors } from "@vendor/clerk";
import { useCheckout, usePaymentMethods } from "@vendor/clerk";
import { AlertCircle, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

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
  const defaultMethod = useMemo(
    () => getDefaultPaymentMethod(methods),
    [methods]
  );
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const paymentMethodId = selectedMethodId ?? defaultMethod?.id;
  const selectedMethod = methods.find(
    (method) => method.id === paymentMethodId
  );

  async function submitSelectedMethod() {
    if (
      !paymentMethodId ||
      fetchStatus === "fetching" ||
      isSubmittingRef.current
    ) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await checkout.confirm({ paymentMethodId });
      if (result.error) {
        setErrorMessage(checkoutErrorMessage(result.error));
        return;
      }
      const finalizeResult = await checkout.finalize({
        // Soft client-side navigation: lets the dialog's onComplete (close +
        // invalidate the billing overview) run and the route re-render in place.
        // A hard window.location.href reload here would unmount the dialog
        // before onComplete and white-flash the whole page.
        navigate: ({ decorateUrl }) => {
          window.history.replaceState(
            null,
            "",
            decorateUrl(window.location.pathname)
          );
        },
      });
      if (finalizeResult.error) {
        setErrorMessage(checkoutErrorMessage(finalizeResult.error));
        return;
      }
      onComplete();
    } catch (error) {
      setErrorMessage(checkoutErrorMessage(error));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
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
        disabled={
          !paymentMethodId || fetchStatus === "fetching" || isSubmitting
        }
        onClick={() => void submitSelectedMethod()}
        size="sm"
      >
        {(fetchStatus === "fetching" || isSubmitting) && (
          <Loader2 className="size-4 animate-spin" />
        )}
        Complete Purchase
      </Button>
    </div>
  );
}

function CheckoutErrors({
  errorMessage,
  errors,
}: {
  errorMessage: string | null;
  errors: ClerkCheckoutErrors["global"];
}) {
  const messages = [
    ...(errorMessage ? [errorMessage] : []),
    ...(errors ?? []).map(
      (error) => error.longMessage ?? error.message ?? "Checkout failed"
    ),
  ];
  if (messages.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription>
        {messages.map((message, index) => (
          <p key={index}>{message}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="h-5 animate-pulse rounded bg-muted/40">
      <span className="sr-only">{label}</span>
    </div>
  );
}
