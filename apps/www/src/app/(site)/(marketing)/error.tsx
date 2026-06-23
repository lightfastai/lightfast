"use client";

import { Button } from "@repo/ui-v2/components/ui/button";
import { captureException } from "@sentry/browser";
import Link from "next/link";
import { useEffect } from "react";

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-svh items-center py-28 text-center text-foreground sm:py-32 lg:py-24">
      <div className="mx-auto w-full max-w-md">
        <p className="text-muted-foreground text-sm leading-6">500</p>
        <h1 className="mt-4 font-medium text-3xl leading-tight tracking-normal">
          Something went wrong
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-7">
          Sorry, something went wrong on our end.
        </p>
        {error.digest ? (
          <p className="mt-4 [overflow-wrap:anywhere] font-mono text-muted-foreground text-xs leading-5">
            Error ID: {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()} type="button">
            Try again
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/" />}
            variant="secondary"
          >
            Return home
          </Button>
        </div>
      </div>
    </main>
  );
}
