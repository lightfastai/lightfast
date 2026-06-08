import { useUser } from "@clerk/tanstack-react-start";
import { useSignUp } from "@clerk/tanstack-react-start/legacy";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { AuthShell } from "~/auth/components/auth-shell";
import { ErrorBanner } from "~/auth/components/error-banner";
import { authErrorMessage, mapOtpClerkError } from "~/auth/errors";
import { makeFinalizeNavigate } from "~/auth/navigate";
import {
  parseAuthErrorCode,
  parseAuthErrorMessage,
} from "~/auth/search-params";
import { authBreadcrumb, authSpan } from "~/auth/telemetry";

const SUCCESS_REDIRECT = "/";

function validateAcceptInvitationSearch(search: Record<string, unknown>) {
  const ticket =
    typeof search.__clerk_ticket === "string" &&
    search.__clerk_ticket.length > 0
      ? search.__clerk_ticket
      : null;
  const error = parseAuthErrorMessage(search.error);
  const errorCode = parseAuthErrorCode(search.errorCode);

  return {
    ...(ticket ? { __clerk_ticket: ticket } : {}),
    ...(error ? { error } : {}),
    ...(errorCode ? { errorCode } : {}),
  };
}

function ticketPath(
  ticket: string | null | undefined,
  params: { errorCode?: string; error?: string } = {}
) {
  if (!ticket) {
    return "/sign-up";
  }

  const search = new URLSearchParams({ __clerk_ticket: ticket });
  if (params.errorCode) {
    search.set("errorCode", params.errorCode);
  } else if (params.error) {
    search.set("error", params.error);
  }
  return `/sign-up/accept-invitation?${search.toString()}`;
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

export const Route = createFileRoute("/sign-up_/accept-invitation")({
  validateSearch: validateAcceptInvitationSearch,
  head: () => ({
    meta: [
      { title: "Accept Invitation - Lightfast Auth" },
      {
        name: "description",
        content: "Accept your Lightfast invitation and create your account.",
      },
    ],
  }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  return (
    <AuthShell>
      <AcceptInvitationView />
    </AuthShell>
  );
}

function AcceptInvitationView() {
  const { isLoaded, setActive, signUp } = useSignUp();
  const { isLoaded: isUserLoaded, isSignedIn } = useUser();
  const search = Route.useSearch();
  const ticket = search.__clerk_ticket ?? null;
  const hasError = !!(search.error ?? search.errorCode);
  const authReady = isLoaded && !!signUp;

  const [submitting, setSubmitting] = React.useState(false);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  React.useEffect(() => {
    if (!(isUserLoaded && isSignedIn) || isRedirecting) {
      return;
    }
    setIsRedirecting(true);
    window.location.replace(SUCCESS_REDIRECT);
  }, [isRedirecting, isSignedIn, isUserLoaded]);

  const handleAccept = React.useCallback(async () => {
    if (!(ticket && authReady) || submitting) {
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
          signUp.create({
            legalAccepted: true,
            strategy: "ticket",
            ticket,
          })
      );

      if (
        signUpAttempt.status === "complete" &&
        signUpAttempt.createdSessionId
      ) {
        authBreadcrumb("Invitation accepted", "info", { mode: "sign-up" });
        let navigationBlocked = false;
        await setActive({
          session: signUpAttempt.createdSessionId,
          navigate: makeFinalizeNavigate(SUCCESS_REDIRECT, {
            onBlockedTask: () => {
              navigationBlocked = true;
            },
          }),
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
        missingFields: signUpAttempt.missingFields,
        mode: "sign-up",
        status: signUpAttempt.status,
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
          ticketPath(ticket, { errorCode: mapped.errorCode })
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
  }, [authReady, setActive, signUp, submitting, ticket]);

  if (!ticket) {
    return (
      <div className="w-full space-y-4 text-center">
        <h1 className="font-medium font-pp text-3xl text-foreground">
          No Invitation Found
        </h1>
        <p className="text-muted-foreground text-sm">
          This page requires a valid invitation link. Check your email for your
          invitation, or visit{" "}
          <Link className="underline" to="/sign-up">
            sign up
          </Link>{" "}
          to create an account.
        </p>
      </div>
    );
  }

  const expiry = decodeTicketExpiry(ticket);

  return (
    <div className="w-full space-y-8">
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
            backUrl={ticketPath(ticket)}
            errorCode={search.errorCode}
            message={
              search.errorCode
                ? authErrorMessage(search.errorCode)
                : (search.error ?? null)
            }
          />
        )}

        {!hasError && (
          <>
            <Button
              className="w-full"
              disabled={submitting || !authReady}
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
