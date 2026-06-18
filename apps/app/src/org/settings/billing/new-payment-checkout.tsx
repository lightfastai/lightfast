import {
  AlertCircleIcon as AlertCircle,
  Loading03Icon as Loader2,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { checkoutErrorMessage } from "@repo/app-billing";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import type { CheckoutErrors as ClerkCheckoutErrors } from "@vendor/clerk";
import { PaymentElement, useCheckout, usePaymentElement } from "@vendor/clerk";
import type { FormEvent } from "react";
import { useState } from "react";

export function NewPaymentCheckout({ onComplete }: { onComplete: () => void }) {
  const { checkout, errors, fetchStatus } = useCheckout();
  const { isFormReady, submit } = usePaymentElement();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = isProcessing || fetchStatus === "fetching";

  async function submitNewMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormReady || isSubmitting) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const paymentResult = await submit();
      if (paymentResult.error) {
        setErrorMessage(checkoutErrorMessage(paymentResult.error));
        return;
      }
      const confirmResult = await checkout.confirm(paymentResult.data);
      if (confirmResult.error) {
        setErrorMessage(checkoutErrorMessage(confirmResult.error));
        return;
      }
      const finalizeResult = await checkout.finalize({
        // Soft client-side navigation: lets the dialog's onComplete (close +
        // invalidate the billing overview) run and the route re-render in
        // place. A hard window.location.href reload here would unmount the
        // dialog before onComplete and white-flash the whole page.
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
      setIsProcessing(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submitNewMethod}>
      <PaymentElement
        fallback={
          <div className="rounded-md border border-border/60 px-3 py-3 text-muted-foreground text-sm">
            Loading payment element...
          </div>
        }
      />
      <CheckoutErrors errorMessage={errorMessage} errors={errors.global} />
      <Button disabled={!isFormReady || isSubmitting} size="sm" type="submit">
        {isSubmitting && (
          <HugeiconsIcon className="size-4 animate-spin" icon={Loader2} />
        )}
        Pay with new card
      </Button>
    </form>
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
      <HugeiconsIcon className="size-4" icon={AlertCircle} />
      <AlertDescription>
        {messages.map((message, index) => (
          <p key={index}>{message}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
}
