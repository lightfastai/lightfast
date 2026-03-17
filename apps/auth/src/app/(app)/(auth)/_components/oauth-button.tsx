"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { addBreadcrumb, startSpan } from "@sentry/nextjs";
import { useSignIn, useSignUp } from "@vendor/clerk/client";
import type { OAuthStrategy } from "@vendor/clerk/types";
import * as React from "react";
import { consoleUrl } from "~/lib/related-projects";

interface OAuthButtonProps {
  mode: "sign-in" | "sign-up";
  onError?: (message: string, isWaitlist?: boolean) => void;
  ticket?: string | null;
}

export function OAuthButton({ mode, ticket, onError }: OAuthButtonProps) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [loading, setLoading] = React.useState(false);

  async function handleTicketSignUp(strategy: OAuthStrategy) {
    const { error } = await startSpan(
      {
        name: "auth.oauth.initiate",
        op: "auth",
        attributes: { strategy, mode },
      },
      () =>
        signUp.sso(
          // Clerk FAPI accepts `ticket` in sso() for invitation flows; TS types omit this field
          {
            strategy,
            ticket: ticket!,
            redirectCallbackUrl: "/sign-up/sso-callback",
            redirectUrl: `${consoleUrl}/account/welcome`,
          } as unknown as Parameters<typeof signUp.sso>[0]
        )
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
        const msg =
          "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.";
        if (onError) {
          onError(msg, true);
        } else {
          window.location.href = `/sign-up?error=${encodeURIComponent(msg)}&waitlist=true`;
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
        onError?.(
          "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
          true
        );
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
        const msg =
          "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.";
        if (onError) {
          onError(msg, true);
        } else {
          window.location.href = `/sign-up?error=${encodeURIComponent(msg)}&waitlist=true`;
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
