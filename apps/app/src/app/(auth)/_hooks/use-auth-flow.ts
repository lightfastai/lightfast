"use client";

import { toast } from "@repo/ui/components/ui/sonner";
import { useAuth, useClerk, useSignIn, useSignUp } from "@vendor/clerk/client";
import type { OAuthStrategy } from "@vendor/clerk/types";
import * as React from "react";
import {
  authErrorMessage,
  mapOAuthClerkError,
  mapOtpClerkError,
} from "./auth-errors";
import { authBreadcrumb, authSpan } from "./auth-telemetry";

const SUCCESS_REDIRECT = "/account/welcome";

type AuthMode = "sign-in" | "sign-up";
type AuthStep = "email" | "code" | "activate";

interface UseAuthFlowInput {
  email?: string | null;
  mode: AuthMode;
  onWaitlistError?: () => void;
  step: AuthStep;
  ticket?: string | null;
  token?: string | null;
}

interface OAuthSlice {
  initiate: (strategy: OAuthStrategy) => Promise<void>;
  loading: boolean;
}

interface OtpSlice {
  code: string;
  email: string | null;
  error: string | null;
  isInitializing: boolean;
  isRedirecting: boolean;
  isResending: boolean;
  isVerifying: boolean;
  onCodeChange: (v: string) => void;
  onResend: () => Promise<void>;
  onReset: () => void;
}

interface ActivateSlice {
  error: string | null;
}

interface UseAuthFlowReturn {
  activate: ActivateSlice;
  oauth: OAuthSlice;
  otp: OtpSlice;
}

// Clerk passes { session, decorateUrl } to the navigate callback in
// finalize({ navigate }). decorateUrl appends ITP cookie-refresh params for
// Safari third-party cookie environments. We hard-nav (window.location.href)
// because finalize calls navigate AFTER the session is active and we want a
// full reload to pick up any server-rendered state on /account/welcome.
interface NavigateArgs {
  decorateUrl: (url: string) => string;
}

export function useAuthFlow(input: UseAuthFlowInput): UseAuthFlowReturn {
  const { mode, step, email, ticket, token, onWaitlistError } = input;
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const clerk = useClerk();
  // useAuth gives a reactive isLoaded that flips when Clerk has hydrated the
  // browser client (clerk.client.signIn becomes safe to call). useSignIn's own
  // isLoaded was returning undefined in dev with the Future-API toggle on.
  const { isLoaded: isClerkLoaded } = useAuth();

  const navigateToSuccess = React.useCallback(
    async ({ decorateUrl }: NavigateArgs) => {
      window.location.href = decorateUrl(SUCCESS_REDIRECT);
    },
    []
  );

  const handleWaitlist = React.useCallback(() => {
    if (onWaitlistError) {
      onWaitlistError();
      return;
    }
    const target = mode === "sign-in" ? "/sign-in" : "/sign-up";
    window.location.href = `${target}?errorCode=waitlist`;
  }, [onWaitlistError, mode]);

  // --- OAuth slice ---
  const [oauthLoading, setOauthLoading] = React.useState(false);

  const handleOAuthMapped = React.useCallback(
    (
      mapped: ReturnType<typeof mapOAuthClerkError>,
      strategy: OAuthStrategy,
      label: string
    ) => {
      if (mapped.kind === "code" && mapped.errorCode === "waitlist") {
        authBreadcrumb(`OAuth blocked by waitlist (${label})`, "warning", {
          strategy,
        });
        handleWaitlist();
        return;
      }
      if (mapped.kind === "redirect") {
        window.location.href = mapped.target;
        return;
      }
      if (mapped.kind === "inline") {
        toast.error(mapped.message);
      }
    },
    [handleWaitlist]
  );

  const initiateOAuth = React.useCallback(
    async (strategy: OAuthStrategy): Promise<void> => {
      setOauthLoading(true);
      // Breadcrumb message preserved verbatim from oauth-button.tsx so
      // existing Sentry dashboards/alerts keyed on the string still match.
      authBreadcrumb("OAuth sign-in initiated", "info", { strategy, mode });

      try {
        if (mode === "sign-up" && ticket) {
          // Ticket-OAuth flow: signUp.create({ ticket }) creates the resource;
          // a follow-up call PATCHes it with the OAuth strategy + legal_accepted
          // and gets the IdP redirect URL.
          //
          // The Future API's signUp.sso() is broken in clerk-js@6.8.0 when
          // called after signUp.create({ticket}): it POSTs to the *collection*
          // URL /v1/client/sign_ups (with ?_method=PATCH) instead of the
          // resource URL /v1/client/sign_ups/{id}, returning 405. Drop to the
          // legacy clerk.client.signUp.authenticateWithRedirect with
          // continueSignUp:true, which routes through SignUp.update() and
          // PATCHes /v1/client/sign_ups/{id} correctly. Mirrors the activate
          // slice workaround at use-auth-flow.ts:553.
          const { error: createError } = await authSpan(
            "auth.ticket.create",
            { mode, strategy },
            () => signUp.create({ ticket })
          );
          if (createError) {
            handleOAuthMapped(
              mapOAuthClerkError(createError),
              strategy,
              "ticket create"
            );
            setOauthLoading(false);
            return;
          }

          try {
            await authSpan("auth.oauth.initiate", { mode, strategy }, () =>
              clerk.client.signUp.authenticateWithRedirect({
                strategy,
                redirectUrl: `/sign-up/sso-callback?__clerk_ticket=${encodeURIComponent(ticket)}`,
                redirectUrlComplete: SUCCESS_REDIRECT,
                continueSignUp: true,
                legalAccepted: true,
              })
            );
          } catch (ssoError) {
            handleOAuthMapped(
              mapOAuthClerkError(ssoError),
              strategy,
              "ticket flow"
            );
            setOauthLoading(false);
          }
          return;
        }

        const callbackUrl =
          mode === "sign-in"
            ? "/sign-in/sso-callback"
            : "/sign-up/sso-callback";
        const resource = mode === "sign-in" ? signIn : signUp;

        // Standard sign-up SSO intentionally omits legalAccepted —
        // sign-up/sso-callback/page.tsx runs a patch effect that applies it
        // post-callback. Adding legalAccepted here would race that patch.
        const { error } = await authSpan(
          "auth.oauth.initiate",
          { mode, strategy },
          () =>
            resource.sso({
              strategy,
              redirectCallbackUrl: callbackUrl,
              redirectUrl: SUCCESS_REDIRECT,
            })
        );
        if (error) {
          handleOAuthMapped(mapOAuthClerkError(error), strategy, "sso");
          setOauthLoading(false);
        }
      } catch {
        toast.error("An unexpected error occurred");
        setOauthLoading(false);
      }
    },
    [mode, ticket, clerk, signIn, signUp, handleOAuthMapped]
  );

  // --- OTP slice ---
  const [code, setCode] = React.useState("");
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(step === "code");
  const [resolvedEmail, setResolvedEmail] = React.useState<string | null>(
    email ?? null
  );

  const hasInitRef = React.useRef(false);
  const verifyingCodeRef = React.useRef<string | null>(null);

  const handleOtpClerkError = React.useCallback(
    (err: unknown): { success: boolean } => {
      if (!err) {
        return { success: false };
      }
      const mapped = mapOtpClerkError(err);
      if (mapped.kind === "success") {
        return { success: true };
      }
      if (mapped.kind === "redirect") {
        window.location.href = mapped.target;
        return { success: false };
      }
      if (mapped.kind === "code") {
        if (mapped.errorCode === "waitlist") {
          handleWaitlist();
          return { success: false };
        }
        setOtpError(authErrorMessage(mapped.errorCode));
        return { success: false };
      }
      setOtpError(mapped.message);
      return { success: false };
    },
    [handleWaitlist]
  );

  // Init effect: send the OTP (or apply the invitation ticket) exactly once
  // when step === "code".
  React.useEffect(() => {
    if (step !== "code" || hasInitRef.current) {
      return;
    }
    hasInitRef.current = true;

    if (mode === "sign-in" && !email) {
      setOtpError("Missing email. Please start over.");
      setIsInitializing(false);
      return;
    }

    async function init() {
      if (mode === "sign-up" && ticket) {
        // Clerk's invitation flow does NOT auto-populate signUp.emailAddress
        // from the ticket — without explicit emailAddress, the SignUp resource
        // has missingFields=["email_address"] and verifications.sendEmailCode()
        // fails with "Email address missing on Sign Up Preparation".
        // strategy: "ticket" disambiguates from the no-ticket sign-up path.
        const { error: createError } = await signUp.create({
          strategy: "ticket",
          ticket,
          emailAddress: email ?? undefined,
          legalAccepted: true,
        });
        if (createError) {
          const mapped = mapOtpClerkError(createError);
          // Ticket-consume rejections (revoked, already-redeemed, expired,
          // generic) happen AFTER the URL has transitioned to ?step=code, so
          // surfacing them inline would layer the error over the "We sent a
          // verification code" UI — confusing copy. Reset to the email step
          // with ErrorBanner instead. The ticket is no longer usable; drop it.
          if (mapped.kind === "redirect") {
            window.location.href = mapped.target;
            return;
          }
          if (mapped.kind === "code") {
            if (mapped.errorCode === "waitlist") {
              handleWaitlist();
              return;
            }
            window.location.href = `/sign-up?errorCode=${mapped.errorCode}`;
            return;
          }
          if (mapped.kind === "inline") {
            const params = new URLSearchParams({ error: mapped.message });
            window.location.href = `/sign-up?${params.toString()}`;
            return;
          }
          // mapped.kind === "success" — fall through to the status check.
        }
        if (signUp.status === "complete") {
          setIsRedirecting(true);
          await signUp.finalize({ navigate: navigateToSuccess });
          return;
        }
        setResolvedEmail(signUp.emailAddress ?? email ?? null);

        const { error: sendError } = await authSpan(
          "auth.otp.send",
          { mode },
          () => signUp.verifications.sendEmailCode()
        );
        if (sendError) {
          authBreadcrumb("OTP send failed", "error", {
            code: sendError.code,
            mode,
          });
          handleOtpClerkError(sendError);
        } else {
          authBreadcrumb("OTP code sent", "info", { mode, email });
        }
        return;
      }

      if (mode === "sign-in") {
        const { error: sendError } = await authSpan(
          "auth.otp.send",
          { mode },
          () => signIn.emailCode.sendCode({ emailAddress: email ?? undefined })
        );
        if (sendError) {
          authBreadcrumb("OTP send failed", "error", {
            code: sendError.code,
            mode,
          });
          handleOtpClerkError(sendError);
        } else {
          authBreadcrumb("OTP code sent", "info", { mode, email });
        }
        return;
      }

      // mode === "sign-up" without ticket
      const { error: createError } = await signUp.create({
        emailAddress: email ?? undefined,
        legalAccepted: true,
      });
      if (createError) {
        handleOtpClerkError(createError);
        return;
      }
      const { error: sendError } = await authSpan(
        "auth.otp.send",
        { mode },
        () => signUp.verifications.sendEmailCode()
      );
      if (sendError) {
        authBreadcrumb("OTP send failed", "error", {
          code: sendError.code,
          mode,
        });
        handleOtpClerkError(sendError);
      } else {
        authBreadcrumb("OTP code sent", "info", { mode, email });
      }
    }

    init()
      .catch(() =>
        setOtpError("An unexpected error occurred. Please try again.")
      )
      .finally(() => setIsInitializing(false));
  }, [
    step,
    mode,
    ticket,
    email,
    signIn,
    signUp,
    handleOtpClerkError,
    handleWaitlist,
    navigateToSuccess,
  ]);

  // Auto-verify effect: fires on code.length === 6, guarded by verifyingCodeRef.
  React.useEffect(() => {
    if (step !== "code") {
      return;
    }
    if (code.length !== 6 || otpError || isInitializing) {
      return;
    }
    if (verifyingCodeRef.current === code) {
      return;
    }
    verifyingCodeRef.current = code;

    async function verify() {
      authBreadcrumb("OTP verification attempt", "info", { mode });
      setIsVerifying(true);
      try {
        if (mode === "sign-in") {
          const { error: verifyError } = await authSpan(
            "auth.otp.verify",
            { mode },
            () => signIn.emailCode.verifyCode({ code })
          );
          if (verifyError) {
            authBreadcrumb("OTP verification failed", "warning", {
              code: verifyError.code,
              mode,
            });
            const { success } = handleOtpClerkError(verifyError);
            if (!success) {
              verifyingCodeRef.current = null;
              setIsVerifying(false);
              return;
            }
          }
          if (signIn.status === "complete") {
            authBreadcrumb("OTP verified", "info", { mode });
            setIsRedirecting(true);
            await signIn.finalize({ navigate: navigateToSuccess });
          } else {
            verifyingCodeRef.current = null;
            setOtpError(
              "Sign-in could not be completed. Please try again or contact support."
            );
            setIsVerifying(false);
          }
          return;
        }

        const { error: verifyError } = await authSpan(
          "auth.otp.verify",
          { mode },
          () => signUp.verifications.verifyEmailCode({ code })
        );
        if (verifyError) {
          authBreadcrumb("OTP verification failed", "warning", {
            code: verifyError.code,
            mode,
          });
          const { success } = handleOtpClerkError(verifyError);
          if (!success) {
            verifyingCodeRef.current = null;
            setIsVerifying(false);
            return;
          }
        }
        if (signUp.status === "complete") {
          authBreadcrumb("OTP verified", "info", { mode });
          setIsRedirecting(true);
          await signUp.finalize({ navigate: navigateToSuccess });
        } else {
          verifyingCodeRef.current = null;
          setOtpError(
            "Sign-up could not be completed. Please try again or contact support."
          );
          setIsVerifying(false);
        }
      } catch {
        verifyingCodeRef.current = null;
        setOtpError("An unexpected error occurred. Please try again.");
        setIsVerifying(false);
      }
    }

    verify();
  }, [
    step,
    code,
    otpError,
    isInitializing,
    mode,
    signIn,
    signUp,
    handleOtpClerkError,
    navigateToSuccess,
  ]);

  const onCodeChange = React.useCallback((value: string) => {
    setOtpError(null);
    if (value.length < 6) {
      verifyingCodeRef.current = null;
    }
    setCode(value);
  }, []);

  const onResend = React.useCallback(async () => {
    // Don't race the init effect's initial sendCode — Clerk will return
    // too_many_requests for the second concurrent send.
    if (isInitializing) {
      return;
    }
    setIsResending(true);
    setOtpError(null);
    authBreadcrumb("OTP resend requested", "info", { mode });
    try {
      const { error: sendError } = await authSpan(
        "auth.otp.send",
        { mode },
        () =>
          mode === "sign-in"
            ? signIn.emailCode.sendCode({ emailAddress: email ?? undefined })
            : signUp.verifications.sendEmailCode()
      );
      if (sendError) {
        authBreadcrumb("OTP resend failed", "error", {
          code: sendError.code,
          mode,
        });
        handleOtpClerkError(sendError);
      } else {
        authBreadcrumb("OTP code resent", "info", { mode });
        toast.success("Verification code sent to your email");
        setCode("");
        verifyingCodeRef.current = null;
      }
    } catch {
      setOtpError("An unexpected error occurred. Please try again.");
    }
    setIsResending(false);
  }, [isInitializing, mode, email, signIn, signUp, handleOtpClerkError]);

  const onReset = React.useCallback(() => {
    if (mode === "sign-in") {
      window.location.href = "/sign-in";
      return;
    }
    const ticketParam = ticket
      ? `?__clerk_ticket=${encodeURIComponent(ticket)}`
      : "";
    window.location.href = `/sign-up${ticketParam}`;
  }, [mode, ticket]);

  // --- Activate slice ---
  const [activateError, setActivateError] = React.useState<string | null>(null);
  const hasActivatedRef = React.useRef(false);

  React.useEffect(() => {
    if (step !== "activate" || !token || hasActivatedRef.current) {
      return;
    }
    // Wait for Clerk to finish hydrating; clerk.client is undefined until then
    // and clerk.client.signIn.create would throw "Cannot read 'signIn' of undefined".
    if (!(isClerkLoaded && clerk?.client?.signIn)) {
      return;
    }
    // Strict-mode + invitation-ticket guard: the underlying Clerk client
    // consumes the ticket on first call. Without this ref, React 18 strict
    // mode's double effect-fire in dev calls create() twice — the second call
    // sees an already-consumed ticket and trips a spurious "Sign-in failed".
    hasActivatedRef.current = true;

    const ticketToken = token;
    async function activate() {
      authBreadcrumb("Session activation via ticket", "info", {});
      // Clerk's Future API signIn proxy (useSignIn) does not propagate ticket-
      // based sign-in state: signIn.ticket() and signIn.create({ strategy:
      // "ticket" }) both leave the React signIn.status null even though the
      // underlying Client creates a pending session. We drop to clerk.client
      // for the call (which returns a usable status + createdSessionId) and
      // promote via clerk.setActive.
      try {
        const result = await authSpan("auth.session.activate", { mode }, () =>
          clerk.client.signIn.create({
            strategy: "ticket",
            ticket: ticketToken,
          })
        );
        if (result.status === "complete" && result.createdSessionId) {
          authBreadcrumb("Session activated", "info", {});
          await clerk.setActive({ session: result.createdSessionId });
          window.location.href = SUCCESS_REDIRECT;
          return;
        }
        setActivateError("Sign-in failed. Please try again.");
      } catch (err) {
        // verification_already_verified can fire here on retry/refresh — if a
        // session is already active, treat that as success.
        const mapped = mapOtpClerkError(err);
        if (mapped.kind === "success" && clerk.session) {
          window.location.href = SUCCESS_REDIRECT;
          return;
        }
        // Surface specific error copy when available (e.g. ticket_expired →
        // "This invitation link has expired"). Falls back to the generic copy
        // for the unmapped default branch.
        if (mapped.kind === "inline" && mapped.message) {
          setActivateError(mapped.message);
          return;
        }
        if (mapped.kind === "code") {
          setActivateError(authErrorMessage(mapped.errorCode));
          return;
        }
        setActivateError("Sign-in failed. Please try again.");
      }
    }
    activate().catch(() =>
      setActivateError("Sign-in failed. Please try again.")
    );
  }, [step, token, mode, clerk, isClerkLoaded]);

  return {
    oauth: { initiate: initiateOAuth, loading: oauthLoading },
    otp: {
      code,
      email: resolvedEmail,
      error: otpError,
      isInitializing,
      isVerifying,
      isRedirecting,
      isResending,
      onCodeChange,
      onResend,
      onReset,
    },
    activate: { error: activateError },
  };
}
