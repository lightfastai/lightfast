"use client";

import { Button } from "@repo/ui/components/ui/button";
import { captureException } from "@sentry/nextjs";
import type { Route } from "next";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

interface AutomationDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AutomationDetailError({
  error,
  reset,
}: AutomationDetailErrorProps) {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[0] ?? "";

  useEffect(() => {
    captureException(error, {
      tags: { route: "automations/[automationId]" },
    });
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="space-y-4 rounded-lg border border-border/60 px-4 py-6">
        <div>
          <h2 className="font-medium text-foreground text-lg">
            Couldn&apos;t load automation
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            It may have been deleted, or there was a transient error.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            href={`/${slug}/automations` as Route}
          >
            ← Back to automations
          </Link>
          <Button onClick={reset} size="sm" variant="secondary">
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
