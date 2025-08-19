"use client";

import type NextError from "next/error";
import { useEffect } from "react";
import { captureException } from "@sentry/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import { LightfastErrorPage, ErrorCode } from "@repo/ui/components/lightfast-error-page";

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
          GeistMono.variable,
        )}
      >
        <LightfastCustomGridBackground.Root
          marginVertical="25vh"
          marginHorizontal="25vw"
          marginVerticalMobile="25vh"
          marginHorizontalMobile="10vw"
        >
          <LightfastCustomGridBackground.Container>
            <LightfastErrorPage
              code={ErrorCode.InternalServerError}
              description="Sorry, something went wrong on our end."
              errorId={error.digest}
            >
              <Button onClick={() => reset()}>Try again</Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/'}
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
