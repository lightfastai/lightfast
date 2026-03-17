"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { addBreadcrumb, startSpan } from "@sentry/nextjs";
import { useSignIn, useSignUp } from "@vendor/clerk/client";
import type { OAuthStrategy } from "@vendor/clerk/types";
import * as React from "react";
import { consoleUrl } from "~/lib/related-projects";
import type { AuthErrorCode } from "../_lib/search-params";

interface OAuthButtonProps {
  mode: "sign-in" | "sign-up";
  onError?: (errorCode: AuthErrorCode) => void;
  ticket?: string | null;
}

export function OAuthButton({ mode, ticket, onError }: OAuthButtonProps) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [loading, setLoading] = React.useState(false);

  async function handleTicketSignUp(strategy: OAuthStrategy) {
    // Step 1: Apply the ticket to the sign-up resource.
    // signUp.sso() silently drops the `ticket` param — confirmed by clerk-js@5.125.3
    // source inspection. The only path that sends ticket to FAPI is signUp.create().
    const { error: createError } = await startSpan(
      {
        name: "auth.ticket.create",
        op: "auth",
        attributes: { strategy, mode },
      },
      () =>
        signUp.create({
          ticket: ticket!,
        })
    );
    if (createError) {
      const errCode = createError.code;
      if (errCode === "sign_up_restricted_waitlist") {
        addBreadcrumb({
          category: "auth",
          message: "OAuth blocked by waitlist (ticket create step)",
          level: "warning",
          data: { strategy },
        });
        if (onError) {
          onError("waitlist");
        } else {
          window.location.href = "/sign-up?errorCode=waitlist";
        }
      } else {
        toast.error(
          createError.longMessage ??
            createError.message ??
            "Authentication failed"
        );
      }
      setLoading(false);
      return;
    }

    // Step 2: Initiate OAuth. FAPI uses the session cookie to identify the
    // existing sign-up (with ticket attached) rather than creating a fresh one.
    // legalAccepted is passed directly to sso() — SignUpFutureSSOParams extends
    // SignUpFutureAdditionalParams which includes legalAccepted. This sends it
    // in the same FAPI request that initiates the OAuth redirect.
    // InviteOAuthCompleter handles it as a fallback if FAPI resets it post-callback.
    const { error } = await startSpan(
      {
        name: "auth.oauth.initiate",
        op: "auth",
        attributes: { strategy, mode },
      },
      () =>
        signUp.sso({
          strategy,
          redirectCallbackUrl: `/sign-up/sso-callback?__clerk_ticket=${encodeURIComponent(ticket!)}`,
          redirectUrl: `${consoleUrl}/account/welcome`,
          legalAccepted: true,
        })
    );
    if (error) {
      const errCode = error.code;
      if (errCode === "sign_up_restricted_waitlist") {
        addBreadcrumb({
          category: "auth",
          message: "OAuth blocked by waitlist (ticket flow)",
          level: "warning",
          data: { strategy },
        });
        if (onError) {
          onError("waitlist");
        } else {
          window.location.href = "/sign-up?errorCode=waitlist";
        }
      } else {
        toast.error(
          error.longMessage ?? error.message ?? "Authentication failed"
        );
      }
      setLoading(false);
    }
  }

  async function handleSignIn(strategy: OAuthStrategy) {
    const { error } = await startSpan(
      {
        name: "auth.oauth.initiate",
        op: "auth",
        attributes: { strategy, mode },
      },
      () =>
        signIn.sso({
          strategy,
          redirectCallbackUrl: "/sign-in/sso-callback",
          redirectUrl: `${consoleUrl}/account/welcome`,
        })
    );
    if (error) {
      const errCode = error.code;
      if (errCode === "sign_up_restricted_waitlist") {
        addBreadcrumb({
          category: "auth",
          message: "OAuth blocked by waitlist",
          level: "warning",
          data: { strategy: "oauth_github" },
        });
        if (onError) {
          onError("waitlist");
        } else {
          window.location.href = "/sign-in?errorCode=waitlist";
        }
      } else {
        toast.error(
          error.longMessage ?? error.message ?? "Authentication failed"
        );
      }
      setLoading(false);
    }
  }

  async function handleSignUp(strategy: OAuthStrategy) {
    const { error } = await startSpan(
      {
        name: "auth.oauth.initiate",
        op: "auth",
        attributes: { strategy, mode },
      },
      () =>
        signUp.sso({
          strategy,
          redirectCallbackUrl: "/sign-up/sso-callback",
          redirectUrl: `${consoleUrl}/account/welcome`,
        })
    );
    if (error) {
      const errCode = error.code;
      if (errCode === "sign_up_restricted_waitlist") {
        addBreadcrumb({
          category: "auth",
          message: "OAuth blocked by waitlist",
          level: "warning",
          data: { strategy: "oauth_github" },
        });
        if (onError) {
          onError("waitlist");
        } else {
          window.location.href = "/sign-up?errorCode=waitlist";
        }
      } else {
        toast.error(
          error.longMessage ?? error.message ?? "Authentication failed"
        );
      }
      setLoading(false);
    }
  }

  async function handleOAuth(strategy: OAuthStrategy) {
    setLoading(true);
    addBreadcrumb({
      category: "auth",
      message: "OAuth sign-in initiated",
      level: "info",
      data: { strategy: "oauth_github", mode },
    });

    // Determine handler BEFORE entering try/catch (no conditionals inside try)
    const handler =
      mode === "sign-up" && ticket
        ? () => handleTicketSignUp(strategy)
        : mode === "sign-in"
          ? () => handleSignIn(strategy)
          : () => handleSignUp(strategy);

    try {
      await handler();
    } catch {
      toast.error("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <Button
      className="w-full"
      disabled={loading}
      onClick={() => handleOAuth("oauth_github")}
      size="lg"
      variant="outline"
    >
      {loading ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.gitHub className="mr-2 h-4 w-4" />
      )}
      Continue with GitHub
    </Button>
  );
}
