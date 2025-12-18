"use client";

import * as React from "react";
import type { OAuthStrategy } from "@clerk/types";
import { useSignUp } from "@clerk/nextjs";
import { toast } from "@repo/ui/components/ui/sonner";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { handleClerkError } from "~/app/lib/clerk/error-handler";
import { useLogger } from "@vendor/observability/client-log";
import { consoleUrl } from "~/lib/related-projects";

export function OAuthSignUp() {
  const { signUp, isLoaded } = useSignUp();
  const [loading, setLoading] = React.useState<OAuthStrategy | null>(null);
  const log = useLogger();

  const signUpWith = async (strategy: OAuthStrategy) => {
    if (!signUp) return;

    try {
      setLoading(strategy);
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sign-up/sso-callback",
        redirectUrlComplete: `${consoleUrl}/account/teams/new`,
      });
    } catch (err) {
      log.error("[OAuthSignUp] OAuth authentication failed", {
        strategy,
        error: err,
      });

      const errorResult = handleClerkError(err, {
        component: "OAuthSignUp",
        action: "oauth_redirect",
        strategy,
      });

      toast.error(errorResult.userMessage);
      setLoading(null);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full h-12"
      onClick={() => signUpWith("oauth_github")}
      disabled={!isLoaded || loading !== null}
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
