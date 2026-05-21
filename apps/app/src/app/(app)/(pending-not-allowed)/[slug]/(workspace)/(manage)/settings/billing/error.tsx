"use client";

import { Button } from "@repo/ui/components/ui/button";
import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

interface BillingErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BillingError({ error, reset }: BillingErrorProps) {
  useEffect(() => {
    // Scoped to the billing segment so the settings shell + sidebar survive a
    // Clerk billing API failure. Mirrors the (auth)/(early-access) error.tsx
    // observability pattern.
    captureException(error, {
      tags: {
        location: "org-billing-settings",
      },
      extra: {
        errorDigest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="space-y-4 rounded-lg border border-border/60 px-4 py-6">
      <div>
        <h2 className="font-medium text-foreground text-lg">
          Billing is temporarily unavailable
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          We couldn't load billing details for this organization. This is
          usually a temporary issue with the billing provider.
        </p>
      </div>
      <Button onClick={reset} size="sm" variant="secondary">
        Try again
      </Button>
    </div>
  );
}
