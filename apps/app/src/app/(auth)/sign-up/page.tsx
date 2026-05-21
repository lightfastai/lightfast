"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { toast } from "@repo/ui/components/ui/sonner";
import { useSignUp } from "@vendor/clerk/client";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
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

export default function SignUpPage() {
  return (
    <React.Suspense fallback={null}>
      <SignUpView />
    </React.Suspense>
  );
}

function SignUpView() {
  const { signUp } = useSignUp();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const errorCode = parseErrorCode(searchParams.get("errorCode"));
  const hasError = !!(errorParam ?? errorCode);

  const [view, setView] = React.useState<View>("email");
  const [email, setEmail] = React.useState("");
  const [legalAccepted, setLegalAccepted] = React.useState(false);
  const [legalError, setLegalError] = React.useState<string | null>(null);
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

  const handleWaitlist = React.useCallback(() => {
    window.location.replace("/sign-up?errorCode=waitlist");
  }, []);

  const errorPathFor = React.useCallback(
    (params: { errorCode?: string; error?: string }) => {
      const search = new URLSearchParams();
      if (params.errorCode) {
        search.set("errorCode", params.errorCode);
      } else if (params.error) {
        search.set("error", params.error);
      }
      return `/sign-up?${search.toString()}`;
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
    if (!legalAccepted) {
      setLegalError(
        "You must accept the Terms of Service and Privacy Policy to continue."
      );
      return;
    }
    setLegalError(null);
    setSubmitting(true);

    try {
      const { error: createError } = await authSpan(
        "auth.signup.create",
        { mode: "sign-up" },
        () =>
          signUp.create({
            emailAddress: trimmed,
            legalAccepted: true,
          })
      );
      if (createError) {
        authBreadcrumb("Email submit rejected", "warning", {
          mode: "sign-up",
          code: createError.code,
        });
        handleSubmitEmailError(createError);
        return;
      }

      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: makeFinalizeNavigate(SUCCESS_REDIRECT),
        });
        return;
      }

      const { error: sendError } = await authSpan(
        "auth.otp.send",
        { mode: "sign-up" },
        () => signUp.verifications.sendEmailCode()
      );
      if (sendError) {
        authBreadcrumb("OTP send rejected", "warning", {
          mode: "sign-up",
          code: sendError.code,
        });
        handleSubmitEmailError(sendError);
        return;
      }

      authBreadcrumb("OTP code sent (from EmailForm)", "info", {
        mode: "sign-up",
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
      authBreadcrumb("OTP verification attempt", "info", { mode: "sign-up" });
      setIsVerifying(true);
      try {
        const { error: verifyError } = await authSpan(
          "auth.otp.verify",
          { mode: "sign-up" },
          () => signUp.verifications.verifyEmailCode({ code: codeValue })
        );
        if (verifyError) {
          authBreadcrumb("OTP verification failed", "warning", {
            code: verifyError.code,
            mode: "sign-up",
          });
          const { success } = handleOtpClerkError(verifyError);
          if (!success) {
            verifyingCodeRef.current = null;
            setIsVerifying(false);
            return;
          }
        }
        if (signUp.status === "complete") {
          authBreadcrumb("OTP verified", "info", { mode: "sign-up" });
          setIsRedirecting(true);
          await signUp.finalize({
            navigate: makeFinalizeNavigate(SUCCESS_REDIRECT),
          });
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
    },
    [signUp, handleOtpClerkError]
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
    authBreadcrumb("OTP resend requested", "info", { mode: "sign-up" });
    try {
      const { error: sendError } = await authSpan(
        "auth.otp.send",
        { mode: "sign-up" },
        () => signUp.verifications.sendEmailCode()
      );
      if (sendError) {
        authBreadcrumb("OTP resend failed", "error", {
          code: sendError.code,
          mode: "sign-up",
        });
        handleOtpClerkError(sendError);
      } else {
        authBreadcrumb("OTP code resent", "info", { mode: "sign-up" });
        toast.success("Verification code sent to your email");
        setCode("");
        verifyingCodeRef.current = null;
      }
    } catch {
      setOtpError("An unexpected error occurred. Please try again.");
    }
    setIsResending(false);
  }, [signUp, handleOtpClerkError]);

  const onReset = React.useCallback(() => {
    window.location.replace("/sign-up");
  }, []);

  return (
    <div className="w-full max-w-md space-y-8">
      {view === "email" && !hasError && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Sign up for Lightfast
          </h1>
        </div>
      )}

      <div className="space-y-4">
        {hasError && (
          <ErrorBanner
            backUrl="/sign-up"
            errorCode={errorCode}
            message={errorParam}
          />
        )}

        {!hasError && view === "email" && (
          <>
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
              <div className="flex items-start gap-3">
                <Checkbox
                  aria-describedby={legalError ? "legal-error" : undefined}
                  checked={legalAccepted}
                  className="mt-0.5"
                  disabled={submitting}
                  id="legal-accepted"
                  onCheckedChange={(checked) => {
                    setLegalAccepted(checked === true);
                    if (checked === true) {
                      setLegalError(null);
                    }
                  }}
                />
                <label
                  className="text-muted-foreground text-sm leading-relaxed"
                  htmlFor="legal-accepted"
                >
                  I accept the{" "}
                  <MicrofrontendLink
                    className="text-foreground underline hover:text-foreground/80"
                    href="/legal/terms"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Terms of Service
                  </MicrofrontendLink>{" "}
                  and{" "}
                  <MicrofrontendLink
                    className="text-foreground underline hover:text-foreground/80"
                    href="/legal/privacy"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Privacy Policy
                  </MicrofrontendLink>
                </label>
              </div>
              {legalError && (
                <p className="text-destructive text-sm" id="legal-error">
                  {legalError}
                </p>
              )}
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
            <div id="clerk-captcha" />
          </>
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
            title="Verify your email"
          />
        )}
      </div>

      {view === "email" && !hasError && (
        <div className="text-center text-sm">
          <span className="text-muted-foreground">
            Already have an account?{" "}
          </span>
          <Button
            asChild
            className="inline-flex h-auto rounded-none p-0 text-sm"
            variant="link-blue"
          >
            <NextLink href="/sign-in" prefetch>
              Log In
            </NextLink>
          </Button>
        </div>
      )}
    </div>
  );
}
