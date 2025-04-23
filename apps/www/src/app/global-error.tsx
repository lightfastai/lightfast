"use client";

import type NextError from "next/error";
import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@sentry/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";

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
          "dark min-h-screen bg-background font-sans antialiased",
          GeistSans.variable,
          GeistMono.variable,
        )}
      >
        <div className="relative flex min-h-screen flex-col bg-background">
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex h-full flex-1 flex-col items-center justify-center gap-4">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tighter text-foreground">
                  Oops, something went wrong
                </h1>
                <p className="text-lg text-muted-foreground">
                  We've been notified and are working to fix the issue.
                </p>
                {error.digest && (
                  <p className="text-sm text-muted-foreground/60">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
              <div className="flex flex-row gap-2">
                <Button onClick={() => reset()} variant="outline" size="lg">
                  Try again
                </Button>
                <Link href="/" className="gradient-text">
                  <Button variant="ghost" size="lg">
                    Go to home
                  </Button>
                </Link>
              </div>
            </main>
            <SiteFooter />
          </div>
        </div>
      </body>
    </html>
  );
};

export default GlobalError;
