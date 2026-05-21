import { cardLabel, paymentErrorMessage } from "@repo/app-billing";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import type { BillingPaymentMethodResource } from "@vendor/clerk/client/experimental";
import { AlertCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { NewPaymentMethodForm } from "./new-payment-method-form";

export function PaymentMethodDialog({
  defaultPaymentMethod,
  isLoading,
  methods,
  onOpenChange,
  onUpdated,
  open,
  orgId,
}: {
  defaultPaymentMethod: BillingPaymentMethodResource | null;
  isLoading: boolean;
  methods: BillingPaymentMethodResource[];
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  open: boolean;
  orgId?: string;
}) {
  const [mode, setMode] = useState("saved");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateMethod(action: () => Promise<unknown>) {
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      await action();
      onUpdated();
    } catch (error) {
      setErrorMessage(paymentErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="p-8 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Payment method</DialogTitle>
          <DialogDescription>
            Update the saved payment methods Clerk uses for organization
            billing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-xl border px-4 py-4">
            <p className="text-muted-foreground text-sm">
              Current payment method
            </p>
            <p className="mt-2 font-medium">
              {cardLabel(defaultPaymentMethod)}
            </p>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {mode === "saved" ? (
            <>
              {isLoading ? (
                <LoadingLine label="Loading payment methods" />
              ) : methods.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No saved payment methods.
                </p>
              ) : (
                <div className="space-y-3">
                  {methods.map((method) => (
                    <div
                      className="flex items-center justify-between gap-4 rounded-lg border px-4 py-4"
                      key={method.id}
                    >
                      <div>
                        <p className="font-medium">{cardLabel(method)}</p>
                        <p className="mt-1 text-muted-foreground text-sm capitalize">
                          {method.isDefault ? "Default" : method.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!method.isDefault && (
                          <Button
                            disabled={isUpdating}
                            onClick={() =>
                              void updateMethod(() =>
                                method.makeDefault({ orgId })
                              )
                            }
                            size="sm"
                            variant="secondary"
                          >
                            Make default
                          </Button>
                        )}
                        {method.isRemovable && (
                          <Button
                            disabled={isUpdating}
                            onClick={() =>
                              void updateMethod(() => method.remove({ orgId }))
                            }
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => setMode("new")}
                variant="secondary"
              >
                Add new card
              </Button>
            </>
          ) : (
            <NewPaymentMethodForm
              onCancel={() => setMode("saved")}
              onSaved={() => {
                onUpdated();
                setMode("saved");
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="h-5 animate-pulse rounded bg-muted/40">
      <span className="sr-only">{label}</span>
    </div>
  );
}
