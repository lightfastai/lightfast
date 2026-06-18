import {
  billingStripeAppearance,
  paymentErrorMessage,
} from "@repo/app-billing";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { DialogFooter } from "@repo/ui/components/ui/dialog";
import {
  PaymentElement,
  PaymentElementProvider,
  useOrganization,
  usePaymentElement,
} from "@vendor/clerk";
import {
  AlertCircleIcon as AlertCircle,
  Loading03Icon as Loader2,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

export function NewPaymentMethodForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  return (
    <PaymentElementProvider
      for="organization"
      stripeAppearance={billingStripeAppearance}
    >
      <NewPaymentMethodFields onCancel={onCancel} onSaved={onSaved} />
    </PaymentElementProvider>
  );
}

function NewPaymentMethodFields({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { organization } = useOrganization();
  const { isFormReady, submit } = usePaymentElement();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function savePaymentMethod() {
    if (!isFormReady || isSaving) {
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (!organization) {
        setErrorMessage("Organization is unavailable. Please try again.");
        return;
      }
      const result = await submit();
      if (result.error) {
        setErrorMessage(paymentErrorMessage(result.error));
        return;
      }
      await organization.addPaymentMethod({
        gateway: result.data.gateway,
        paymentToken: result.data.paymentToken,
      });
      onSaved();
    } catch (error) {
      setErrorMessage(paymentErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        fallback={
          <div className="rounded-md border px-3 py-3 text-muted-foreground text-sm">
            Loading payment element...
          </div>
        }
      />
      {errorMessage && (
        <Alert variant="destructive">
          <HugeiconsIcon icon={AlertCircle} className="size-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          disabled={!isFormReady || isSaving}
          onClick={() => void savePaymentMethod()}
          type="button"
        >
          {isSaving && <HugeiconsIcon icon={Loader2} className="size-4 animate-spin" />}
          Save card
        </Button>
      </DialogFooter>
    </div>
  );
}
