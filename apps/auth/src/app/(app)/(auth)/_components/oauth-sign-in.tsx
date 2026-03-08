"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { useSignIn } from "@vendor/clerk/client";
import type { OAuthStrategy } from "@vendor/clerk/types";
import { useLogger } from "@vendor/observability/client-log";
import * as React from "react";
import { handleClerkError } from "~/app/lib/clerk/error-handler";
import { consoleUrl } from "~/lib/related-projects";

interface OAuthSignInProps {
  onError?: (error: string, isSignUpRestricted?: boolean) => void;
}

export function OAuthSignIn({ onError }: OAuthSignInProps = {}) {
  const { signIn, isLoaded } = useSignIn();
  const [loading, setLoading] = React.useState<OAuthStrategy | null>(null);
  const log = useLogger();

  const signInWith = async (strategy: OAuthStrategy) => {
    if (!signIn) {
      return;
    }

    try {
      setLoading(strategy);
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sign-in/sso-callback",
        redirectUrlComplete: `${consoleUrl}/account/teams/new`,
      });
    } catch (err) {
      log.error("[OAuthSignIn] OAuth authentication failed", {
        strategy,
        error: err,
      });

      const errorResult = handleClerkError(err, {
        component: "OAuthSignIn",
        action: "oauth_redirect",
        strategy,
      });

      // For waitlist errors, pass to parent form for inline display
      // For other errors, show toast
      if (errorResult.isSignUpRestricted && onError) {
        onError(errorResult.userMessage, errorResult.isSignUpRestricted);
      } else {
        toast.error(errorResult.userMessage);
      }
      setLoading(null);
    }
  };

  return (
    <Button
      className="w-full"
      disabled={!isLoaded || loading !== null}
      onClick={() => signInWith("oauth_github")}
      size="lg"
      variant="outline"
    >
      {loading === "oauth_github" ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.gitHub className="mr-2 h-4 w-4" />
      )}
      Continue with GitHub
    </Button>
  );
}
