"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { useClerk, useSignUp, useUser } from "@vendor/clerk/client";
import type { OAuthStrategy } from "@vendor/clerk/types";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { env } from "~/env";
import { ErrorBanner } from "../../_components/error-banner";
import { SeparatorWithText } from "../../_components/separator-with-text";
import {
  authErrorMessage,
  mapOAuthClerkError,
  mapOtpClerkError,
} from "../../_hooks/auth-errors";
import { authBreadcrumb, authSpan } from "../../_hooks/auth-telemetry";
import { type AuthErrorCode, authErrorCodes } from "../../_lib/search-params";

const SUCCESS_REDIRECT = "/account/welcome";

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
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();
  const { signUp } = useSignUp();
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticket = searchParams.get("__clerk_ticket");
  const errorParam = searchParams.get("error");
  const errorCode = parseErrorCode(searchParams.get("errorCode"));
  const hasError = !!(errorParam ?? errorCode);

  const [submitting, setSubmitting] = React.useState(false);
  const [oauthLoading, setOauthLoading] = React.useState(false);
  const [pageError, setPageError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isUserLoaded && isSignedIn) {
      router.push(SUCCESS_REDIRECT);
    }
  }, [isUserLoaded, isSignedIn, router]);

  React.useEffect(() => {
    const reset = () => setOauthLoading(false);
    window.addEventListener("pagehide", reset);
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pagehide", reset);
      window.removeEventListener("pageshow", reset);
    };
  }, []);

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
    if (!ticket || submitting) {
      return;
    }
    setSubmitting(true);
    setPageError(null);
    authBreadcrumb("Invitation accept initiated", "info", { mode: "sign-up" });

    try {
      // signUp.ticket({ ticket, legalAccepted }) leaves emailAddress null on
      // clerk-js@6.10.1 (status stays "missing_requirements"). signUp.create
      // with explicit strategy:'ticket' is the working shape — auto-populates
      // emailAddress from the invitation and reaches status:'complete' in one
      // call. signUp.create({ ticket, legalAccepted }) without the explicit
      // strategy ALSO leaves emailAddress null. Bug A family for sign-up.
      const { error: ticketError } = await authSpan(
        "auth.ticket.consume",
        { mode: "sign-up" },
        () =>
          signUp.create({
            strategy: "ticket",
            ticket,
            legalAccepted: true,
          })
      );

      if (ticketError) {
        authBreadcrumb("Invitation accept rejected", "warning", {
          mode: "sign-up",
          code: ticketError.code,
        });
        const mapped = mapOtpClerkError(ticketError);
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
      }

      if (signUp.status === "complete") {
        authBreadcrumb("Invitation accepted", "info", { mode: "sign-up" });
        await signUp.finalize({
          navigate: ({ decorateUrl }) => {
            window.location.href = decorateUrl(SUCCESS_REDIRECT);
          },
        });
        return;
      }

      authBreadcrumb("Invitation accept incomplete", "error", {
        mode: "sign-up",
        status: signUp.status,
        missingFields: signUp.missingFields,
      });
      setPageError("Couldn't accept invitation. Please try again.");
      setSubmitting(false);
    } catch {
      setPageError("An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  }, [ticket, submitting, signUp, ticketErrorPath]);

  const handleOAuth = React.useCallback(
    async (strategy: OAuthStrategy) => {
      if (!ticket || oauthLoading) {
        return;
      }
      setOauthLoading(true);
      setPageError(null);
      authBreadcrumb("OAuth sign-in initiated", "info", {
        strategy,
        mode: "sign-up",
      });

      try {
        const { error: createError } = await authSpan(
          "auth.ticket.create",
          { mode: "sign-up", strategy },
          () => signUp.create({ ticket, legalAccepted: true })
        );
        if (createError) {
          const mapped = mapOAuthClerkError(createError);
          if (mapped.kind === "code" && mapped.errorCode === "waitlist") {
            window.location.replace(ticketErrorPath({ errorCode: "waitlist" }));
            return;
          }
          if (mapped.kind === "redirect") {
            window.location.href = mapped.target;
            return;
          }
          if (mapped.kind === "inline") {
            setPageError(mapped.message);
            setOauthLoading(false);
            return;
          }
        }

        // Bug D (clerk-js@6.10.1, unfixed per docs commit b6d805c9a):
        // signUp.sso() called after signUp.create({ticket}) POSTs to the
        // collection URL /v1/client/sign_ups (with ?_method=PATCH) instead
        // of PATCHing /v1/client/sign_ups/{id}, returning 405. Drop to the
        // legacy clerk.client.signUp.authenticateWithRedirect with
        // continueSignUp:true so PATCH /v1/client/sign_ups/{id} fires
        // against the now-ticket-bound resource. Mirrors the workaround at
        // _hooks/use-auth-flow.ts:184-193.
        await authSpan(
          "auth.oauth.initiate",
          { mode: "sign-up", strategy },
          () =>
            clerk.client.signUp.authenticateWithRedirect({
              strategy,
              redirectUrl: `/sign-up/sso-callback?__clerk_ticket=${encodeURIComponent(ticket)}`,
              redirectUrlComplete: SUCCESS_REDIRECT,
              continueSignUp: true,
              legalAccepted: true,
            })
        );
        // On success, Clerk navigates to the IdP — control doesn't return.
      } catch (err) {
        const mapped = mapOAuthClerkError(err);
        if (mapped.kind === "code" && mapped.errorCode === "waitlist") {
          window.location.replace(ticketErrorPath({ errorCode: "waitlist" }));
          return;
        }
        if (mapped.kind === "redirect") {
          window.location.href = mapped.target;
          return;
        }
        if (mapped.kind === "inline") {
          toast.error(mapped.message);
          setOauthLoading(false);
          return;
        }
        toast.error("An unexpected error occurred");
        setOauthLoading(false);
      }
    },
    [ticket, oauthLoading, signUp, clerk, ticketErrorPath]
  );

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
              disabled={oauthLoading || submitting}
              onClick={() => handleOAuth("oauth_github")}
              size="lg"
              variant="outline"
            >
              {oauthLoading ? (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icons.gitHub className="mr-2 h-4 w-4" />
              )}
              Continue with GitHub
            </Button>
            {env.NEXT_PUBLIC_VERCEL_ENV === "development" ? (
              <Button
                className="w-full"
                disabled={oauthLoading || submitting}
                onClick={() => handleOAuth("oauth_custom_test_idp")}
                size="lg"
                variant="outline"
              >
                {oauthLoading ? (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icons.gitHub className="mr-2 h-4 w-4" />
                )}
                Continue with Test IdP
              </Button>
            ) : null}

            <SeparatorWithText text="Or" />

            <Button
              className="w-full"
              disabled={submitting || oauthLoading}
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
