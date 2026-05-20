import type { CheckoutErrors as ClerkCheckoutErrors } from "@vendor/clerk/client/experimental";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function CheckoutErrors({
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
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
}
