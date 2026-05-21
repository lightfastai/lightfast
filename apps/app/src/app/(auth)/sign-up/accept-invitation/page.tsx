"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { useClerk, useUser } from "@vendor/clerk/client";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { ErrorBanner } from "../../_components/error-banner";
import { authErrorMessage, mapOtpClerkError } from "../../_hooks/auth-errors";
import { makeFinalizeNavigate } from "../../_hooks/auth-navigate";
import { authBreadcrumb, authSpan } from "../../_hooks/auth-telemetry";
import { type AuthErrorCode, authErrorCodes } from "../../_lib/search-params";

const SUCCESS_REDIRECT = "/" as Route;

function parseErrorCode(value: string | null): AuthErrorCode | null {
  if (!value) {
    return null;
  }
  return (authErrorCodes as readonly string[]).includes(value)
    ? (value as AuthErrorCode)
    : null;
}

function decodeTicketExpiry(ticket: string): Date | null {
  try {
    const segment = ticket.split(".")[1];
    if (!segment) {
      return null;
    }
    const payload = JSON.parse(
      atob(segment.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: unknown };
    return typeof payload.exp === "number"
      ? new Date(payload.exp * 1000)
      : null;
  } catch {
    return null;
  }
}

export default function AcceptInvitationPage() {
  return (
    <React.Suspense fallback={null}>
      <AcceptInvitationView />
    </React.Suspense>
  );
}

function AcceptInvitationView() {
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticket = searchParams.get("__clerk_ticket");
  const errorParam = searchParams.get("error");
  const errorCode = parseErrorCode(searchParams.get("errorCode"));
  const hasError = !!(errorParam ?? errorCode);

  const [submitting, setSubmitting] = React.useState(false);
  const [pageError, setPageError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isUserLoaded && isSignedIn) {
      router.push(SUCCESS_REDIRECT);
    }
  }, [isUserLoaded, isSignedIn, router]);

  const ticketErrorPath = React.useCallback(
    (params: { errorCode?: string; error?: string }) => {
      if (!ticket) {
        return "/sign-up";
      }
      const search = new URLSearchParams();
      search.set("__clerk_ticket", ticket);
      if (params.errorCode) {
        search.set("errorCode", params.errorCode);
      } else if (params.error) {
        search.set("error", params.error);
      }
      return `/sign-up/accept-invitation?${search.toString()}`;
    },
    [ticket]
  );

  const handleAccept = React.useCallback(async () => {
    if (!ticket || submitting || !clerk.loaded) {
      return;
    }
    setSubmitting(true);
    setPageError(null);
    authBreadcrumb("Invitation accept initiated", "info", { mode: "sign-up" });

    try {
      const signUpAttempt = await authSpan(
        "auth.ticket.consume",
        { mode: "sign-up" },
        () =>
          clerk.client.signUp.create({
            strategy: "ticket",
            ticket,
            legalAccepted: true,
          })
      );
      if (signUpAttempt.status === "complete") {
        authBreadcrumb("Invitation accepted", "info", { mode: "sign-up" });
        let navigationBlocked = false;
        const navigateAfterSession = makeFinalizeNavigate(SUCCESS_REDIRECT, {
          onBlockedTask: () => {
            navigationBlocked = true;
          },
        });
        await clerk.setActive({
          session: signUpAttempt.createdSessionId,
          navigate: navigateAfterSession,
        });
        if (navigationBlocked) {
          setPageError(
            "Additional authentication setup is required before continuing."
          );
          setSubmitting(false);
        }
        return;
      }

      authBreadcrumb("Invitation accept incomplete", "error", {
        mode: "sign-up",
        status: signUpAttempt.status,
        missingFields: signUpAttempt.missingFields,
      });
      setPageError("Couldn't accept invitation. Please try again.");
      setSubmitting(false);
    } catch (err) {
      const mapped = mapOtpClerkError(err);
      if (mapped.kind === "redirect") {
        window.location.replace(mapped.target);
        return;
      }
      if (mapped.kind === "code") {
        window.location.replace(
          ticketErrorPath({ errorCode: mapped.errorCode })
        );
        return;
      }
      if (mapped.kind === "inline") {
        setPageError(mapped.message);
        setSubmitting(false);
        return;
      }
      setPageError("Authentication failed");
      setSubmitting(false);
    }
  }, [clerk, ticket, submitting, ticketErrorPath]);

  if (!ticket) {
    return (
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="font-medium font-pp text-3xl text-foreground">
          No Invitation Found
        </h1>
        <p className="text-muted-foreground text-sm">
          This page requires a valid invitation link. Check your email for your
          invitation, or visit{" "}
          <MicrofrontendLink className="underline" href="/sign-up">
            sign up
          </MicrofrontendLink>{" "}
          to create an account.
        </p>
      </div>
    );
  }

  const expiry = decodeTicketExpiry(ticket);

  return (
    <div className="w-full max-w-md space-y-8">
      {!hasError && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Accept Your Invitation
          </h1>
        </div>
      )}

      <div className="space-y-4">
        {hasError && (
          <ErrorBanner
            backUrl={ticketErrorPath({})}
            errorCode={errorCode}
            message={
              errorCode ? authErrorMessage(errorCode) : (errorParam ?? null)
            }
          />
        )}

        {!hasError && (
          <>
            <Button
              className="w-full"
              disabled={submitting || !clerk.loaded}
              onClick={handleAccept}
              size="lg"
            >
              {submitting ? (
                <Icons.spinner className="h-4 w-4 animate-spin" />
              ) : (
                "Accept Invitation"
              )}
            </Button>

            {pageError && (
              <p className="text-center text-destructive text-sm">
                {pageError}
              </p>
            )}

            <div id="clerk-captcha" />

            {expiry && (
              <p className="text-center text-muted-foreground text-xs">
                Invitation expires{" "}
                {expiry.toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
