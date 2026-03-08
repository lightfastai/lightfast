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

interface AuthErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AuthError({ error, reset }: AuthErrorProps) {
  useEffect(() => {
    // Capture all errors to Sentry for auth routes
    captureException(error, {
      tags: {
        location: "auth-routes",
      },
      extra: {
        errorDigest: error.digest,
      },
    });

    // Always log for local debugging
    console.error("Auth route error:", error);
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
          description="We encountered an issue with authentication. Please try again."
          errorId={error.digest}
        >
          <Button onClick={() => reset()}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/sign-in">Back to Sign In</Link>
          </Button>
        </LightfastErrorPage>
      </LightfastCustomGridBackground.Container>
    </LightfastCustomGridBackground.Root>
  );
}
