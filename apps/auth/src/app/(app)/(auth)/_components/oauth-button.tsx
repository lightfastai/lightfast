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

  async function handleTicketSignUp() {
    const { error: ticketError } = await signUp.ticket({ ticket: ticket! });
    if (ticketError) {
      onError?.(
        "Please use the email option above to complete your invitation sign-up."
      );
      setLoading(false);
      return;
    }
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: async () => {
          window.location.href = `${consoleUrl}/account/welcome`;
        },
      });
      return;
    }
    onError?.(
      "Please use the email option above to complete your invitation sign-up."
    );
    setLoading(false);
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
        ? () => handleTicketSignUp()
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
