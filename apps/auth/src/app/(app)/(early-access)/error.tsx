"use client";

import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import {
  ErrorCode,
  LightfastErrorPage,
} from "@repo/ui/components/lightfast-error-page";
import { Button } from "@repo/ui/components/ui/button";
import { captureException } from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

interface EarlyAccessErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EarlyAccessError({
  error,
  reset,
}: EarlyAccessErrorProps) {
  useEffect(() => {
    captureException(error, {
      tags: {
        location: "early-access-route",
      },
      extra: {
        errorDigest: error.digest,
      },
    });

    console.error("Early access route error:", error);
  }, [error]);

  return (
    <LightfastCustomGridBackground.Root
      marginHorizontal="25vw"
      marginHorizontalMobile="10vw"
      marginVertical="25vh"
      marginVerticalMobile="25vh"
    >
      <LightfastCustomGridBackground.Container>
        <LightfastErrorPage
          code={ErrorCode.InternalServerError}
          description="We encountered an issue. Please try again."
          errorId={error.digest}
        >
          <Button onClick={() => reset()} size="lg">
            Try again
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/early-access">Back to Early Access</Link>
          </Button>
        </LightfastErrorPage>
      </LightfastCustomGridBackground.Container>
    </LightfastCustomGridBackground.Root>
  );
}
