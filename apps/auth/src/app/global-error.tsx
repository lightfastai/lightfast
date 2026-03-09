"use client";

import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import {
  ErrorCode,
  LightfastErrorPage,
} from "@repo/ui/components/lightfast-error-page";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { captureException } from "@sentry/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type NextError from "next/error";
import { useEffect } from "react";

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
          "dark bg-background font-sans antialiased",
          GeistSans.variable,
          GeistMono.variable
        )}
      >
        <LightfastCustomGridBackground.Root
          marginHorizontal="25vw"
          marginHorizontalMobile="10vw"
          marginVertical="25vh"
          marginVerticalMobile="25vh"
        >
          <LightfastCustomGridBackground.Container>
            <LightfastErrorPage
              code={ErrorCode.InternalServerError}
              description="Sorry, something went wrong on our end."
              errorId={error.digest}
            >
              <Button onClick={() => reset()} size="lg">
                Try again
              </Button>
              <Button
                onClick={() => (window.location.href = "/")}
                size="lg"
                variant="outline"
              >
                Return Home
              </Button>
            </LightfastErrorPage>
          </LightfastCustomGridBackground.Container>
        </LightfastCustomGridBackground.Root>
      </body>
    </html>
  );
};

export default GlobalError;
