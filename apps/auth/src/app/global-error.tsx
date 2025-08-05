"use client";

import type NextError from "next/error";
import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@sentry/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { cn } from "@repo/ui/lib/utils";

interface GlobalErrorProperties {
  readonly error: NextError & { digest?: string };
  readonly reset: () => void;
}

const GlobalError = ({ error, reset }: GlobalErrorProperties) => {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <head />
      <body
        className={cn(
          "dark bg-background min-h-screen font-sans antialiased",
          GeistSans.variable,
          GeistMono.variable,
        )}
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="border border-dashed border-border p-32 flex flex-col items-center">
            {/* Lightfast logo */}
            <div className="mb-8">
              <Icons.logoShort className="w-10 h-8 text-white" />
            </div>

            {/* Large error heading */}
            <h1 className="text-8xl font-bold tracking-tighter mb-4">500</h1>

            {/* Error message */}
            <p className="text-muted-foreground text-lg mb-4">
              Sorry, something went wrong on our end.
            </p>

            {/* Error ID if available */}
            {error.digest && (
              <p className="text-muted-foreground/60 text-sm mb-8">
                Error ID: {error.digest}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-row gap-4">
              <Button onClick={() => reset()}>
                Try again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Return Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
};

export default GlobalError;