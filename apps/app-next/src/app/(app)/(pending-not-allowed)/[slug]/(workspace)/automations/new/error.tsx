"use client";

import { Button } from "@repo/ui/components/ui/button";
import { captureException } from "@sentry/nextjs";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

interface NewAutomationErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function NewAutomationError({
  error,
  reset,
}: NewAutomationErrorProps) {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[0] ?? "workspace";

  useEffect(() => {
    captureException(error, {
      tags: { route: "automations/new" },
      extra: {
        errorDigest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="space-y-4 rounded-lg border border-border/60 px-4 py-6">
        <div>
          <h2 className="font-medium text-foreground text-lg">
            Couldn&apos;t load new automation
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            There was a transient error while preparing the automation form.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            href={`/${slug}/automations` as Route}
          >
            Back to automations
          </Link>
          <Button onClick={reset} size="sm" variant="secondary">
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
