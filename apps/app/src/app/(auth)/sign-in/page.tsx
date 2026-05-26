"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { toast } from "@repo/ui/components/ui/sonner";
import { useSignIn, useUser } from "@vendor/clerk";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { parseSafeAuthRedirectTarget } from "~/auth-redirect";
import { ErrorBanner } from "../_components/error-banner";
import { CodeVerificationUI } from "../_components/shared/code-verification-ui";
import { authErrorMessage, mapOtpClerkError } from "../_hooks/auth-errors";
import { makeFinalizeNavigate } from "../_hooks/auth-navigate";
import { authBreadcrumb, authSpan } from "../_hooks/auth-telemetry";
import { type AuthErrorCode, authErrorCodes } from "../_lib/search-params";

const SUCCESS_REDIRECT = "/";

type View = "email" | "code";

function parseErrorCode(value: string | null): AuthErrorCode | null {
  if (!value) {
    return null;
  }
  return (authErrorCodes as readonly string[]).includes(value)
    ? (value as AuthErrorCode)
    : null;
}

export default function SignInPage() {
  return (
    <React.Suspense fallback={null}>
      <SignInView />
    </React.Suspense>
  );
}

function SignInView() {
  const { signIn } = useSignIn();
  const { isLoaded: isUserLoaded, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const successRedirect =
    parseSafeAuthRedirectTarget(searchParams.get("redirect_url")) ??
    SUCCESS_REDIRECT;
  const errorParam = searchParams.get("error");
  const errorCode = parseErrorCode(searchParams.get("errorCode"));
  const hasError = !!(errorParam ?? errorCode);

  const [view, setView] = React.useState<View>("email");
  const [email, setEmail] = React.useState("");
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(
    null
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);

  const verifyingCodeRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isUserLoaded || !isSignedIn || isRedirecting) {
      return;
    }
    setIsRedirecting(true);
    window.location.replace(successRedirect);
  }, [isRedirecting, isSignedIn, isUserLoaded, successRedirect]);

  const handleWaitlist = React.useCallback(() => {
    window.location.replace("/sign-in?errorCode=waitlist");
  }, []);

  const errorPathFor = React.useCallback(
    (params: { errorCode?: string; error?: string }) => {
      const search = new URLSearchParams();
      if (params.errorCode) {
        search.set("errorCode", params.errorCode);
      } else if (params.error) {
        search.set("error", params.error);
      }
      return `/sign-in?${search.toString()}`;
    },
    []
  );

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
        window.location.replace(mapped.target);
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

  const handleSubmitEmailError = React.useCallback(
    (err: unknown) => {
      const mapped = mapOtpClerkError(err);
      if (mapped.kind === "redirect") {
        window.location.href = mapped.target;
        return;
      }
      if (mapped.kind === "code") {
        window.location.replace(errorPathFor({ errorCode: mapped.errorCode }));
        return;
      }
      if (mapped.kind === "inline") {
        window.location.replace(errorPathFor({ error: mapped.message }));
        return;
      }
      window.location.replace(errorPathFor({ error: "Authentication failed" }));
    },
    [errorPathFor]
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);

    try {
      const { error: sendError } = await authSpan(
        "auth.otp.send",
        { mode: "sign-in" },
        () => signIn.emailCode.sendCode({ emailAddress: trimmed })
      );
      if (sendError) {
        authBreadcrumb("Email submit rejected", "warning", {
          mode: "sign-in",
          code: sendError.code,
        });
        handleSubmitEmailError(sendError);
        return;
      }
      authBreadcrumb("OTP code sent (from EmailForm)", "info", {
        mode: "sign-in",
      });
      setSubmittedEmail(trimmed);
      setView("code");
      setSubmitting(false);
    } catch (err) {
      handleSubmitEmailError(err);
    }
  };

  const verifyOtp = React.useCallback(
    async (codeValue: string) => {
      authBreadcrumb("OTP verification attempt", "info", { mode: "sign-in" });
      setIsVerifying(true);
      try {
        const { error: verifyError } = await authSpan(
          "auth.otp.verify",
          { mode: "sign-in" },
          () => signIn.emailCode.verifyCode({ code: codeValue })
        );
        if (verifyError) {
          authBreadcrumb("OTP verification failed", "warning", {
            code: verifyError.code,
            mode: "sign-in",
          });
          const { success } = handleOtpClerkError(verifyError);
          if (!success) {
            verifyingCodeRef.current = null;
            setIsVerifying(false);
            return;
          }
        }
        if (signIn.status === "complete") {
          authBreadcrumb("OTP verified", "info", { mode: "sign-in" });
          setIsRedirecting(true);
          await signIn.finalize({
            navigate: makeFinalizeNavigate(successRedirect),
          });
        } else {
          verifyingCodeRef.current = null;
          setOtpError(
            "Sign-in could not be completed. Please try again or contact support."
          );
          setIsVerifying(false);
        }
      } catch {
        verifyingCodeRef.current = null;
        setOtpError("An unexpected error occurred. Please try again.");
        setIsVerifying(false);
      }
    },
    [signIn, handleOtpClerkError, successRedirect]
  );

  const onCodeChange = React.useCallback(
    (value: string) => {
      setOtpError(null);
      if (value.length < 6) {
        verifyingCodeRef.current = null;
      }
      setCode(value);
      if (value.length !== 6) {
        return;
      }
      if (verifyingCodeRef.current === value) {
        return;
      }
      verifyingCodeRef.current = value;
      void verifyOtp(value);
    },
    [verifyOtp]
  );

  const onResend = React.useCallback(async () => {
    setIsResending(true);
    setOtpError(null);
    authBreadcrumb("OTP resend requested", "info", { mode: "sign-in" });
    try {
      const { error: sendError } = await authSpan(
        "auth.otp.send",
        { mode: "sign-in" },
        () =>
          signIn.emailCode.sendCode({
            emailAddress: submittedEmail ?? undefined,
          })
      );
      if (sendError) {
        authBreadcrumb("OTP resend failed", "error", {
          code: sendError.code,
          mode: "sign-in",
        });
        handleOtpClerkError(sendError);
      } else {
        authBreadcrumb("OTP code resent", "info", { mode: "sign-in" });
        toast.success("Verification code sent to your email");
        setCode("");
        verifyingCodeRef.current = null;
      }
    } catch {
      setOtpError("An unexpected error occurred. Please try again.");
    }
    setIsResending(false);
  }, [signIn, submittedEmail, handleOtpClerkError]);

  const onReset = React.useCallback(() => {
    window.location.replace("/sign-in");
  }, []);

  return (
    <div className="w-full space-y-8">
      {view === "email" && !hasError && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Log in to Lightfast
          </h1>
        </div>
      )}

      <div className="space-y-4">
        {hasError && (
          <ErrorBanner
            backUrl="/sign-in"
            errorCode={errorCode}
            message={errorParam}
          />
        )}

        {!hasError && view === "email" && (
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              autoComplete="email"
              className="bg-background dark:bg-background"
              disabled={submitting}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email Address"
              required
              size="lg"
              type="email"
              value={email}
            />
            <Button
              className="w-full"
              disabled={submitting}
              size="lg"
              type="submit"
            >
              {submitting ? (
                <Icons.spinner className="h-4 w-4 animate-spin" />
              ) : (
                "Continue with Email"
              )}
            </Button>
          </form>
        )}

        {!hasError && view === "code" && (
          <CodeVerificationUI
            code={code}
            email={submittedEmail}
            inlineError={otpError}
            isRedirecting={isRedirecting}
            isResending={isResending}
            isVerifying={isVerifying}
            onCodeChange={onCodeChange}
            onResend={onResend}
            onReset={onReset}
          />
        )}
      </div>
    </div>
  );
}
