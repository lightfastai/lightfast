"use client";

import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import {
  ErrorCode,
  LightfastErrorPage,
} from "@repo/ui/components/lightfast-error-page";
import { Button } from "@repo/ui/components/ui/button";
import { captureException } from "@sentry/nextjs";
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
    <div className="fixed inset-0 z-50">
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
            <Button onClick={() => reset()} size="lg">
              Try again
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="/sign-in">Back to Sign In</a>
            </Button>
          </LightfastErrorPage>
        </LightfastCustomGridBackground.Container>
      </LightfastCustomGridBackground.Root>
    </div>
  );
}
