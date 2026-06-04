import { useUser } from "@clerk/tanstack-react-start";
import { useSignUp } from "@clerk/tanstack-react-start/legacy";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { toast } from "@repo/ui/components/ui/sonner";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { CodeVerificationUI } from "~/auth/components/code-verification-ui";
import { ErrorBanner } from "~/auth/components/error-banner";
import { AuthShell } from "~/auth/components/auth-shell";
import { authErrorMessage, mapOtpClerkError } from "~/auth/errors";
import { makeFinalizeNavigate } from "~/auth/navigate";
import { parseSafeAuthRedirectTarget } from "~/auth/redirect";
import {
  parseAuthErrorCode,
  parseAuthErrorMessage,
} from "~/auth/search-params";
import { authBreadcrumb, authSpan } from "~/auth/telemetry";

const SUCCESS_REDIRECT = "/";

type View = "email" | "code";

function authSearch(redirectUrl: string | null | undefined) {
  return redirectUrl ? { redirect_url: redirectUrl } : {};
}

function authPath(path: string, redirectUrl: string | null | undefined) {
  if (!redirectUrl) {
    return path;
  }

  const search = new URLSearchParams({ redirect_url: redirectUrl });
  return `${path}?${search.toString()}`;
}

function validateSignUpSearch(search: Record<string, unknown>) {
  const error = parseAuthErrorMessage(search.error);
  const errorCode = parseAuthErrorCode(search.errorCode);
  const redirectUrl = parseSafeAuthRedirectTarget(search.redirect_url);

  return {
    ...(error ? { error } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
  };
}

export const Route = createFileRoute("/sign-up")({
  validateSearch: validateSignUpSearch,
  head: () => ({
    meta: [
      { title: "Sign Up - Lightfast Auth" },
      {
        name: "description",
        content:
          "Create your Lightfast account to access the AI agent platform.",
      },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <AuthShell>
      <SignUpView />
    </AuthShell>
  );
}

function SignUpView() {
  const { isLoaded, setActive, signUp } = useSignUp();
  const { isLoaded: isUserLoaded, isSignedIn } = useUser();
  const search = Route.useSearch();
  const redirectUrl = search.redirect_url;
  const successRedirect = redirectUrl ?? SUCCESS_REDIRECT;
  const hasError = !!(search.error ?? search.errorCode);
  const authReady = isLoaded && !!signUp;

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

  React.useEffect(() => {
    if (!(isUserLoaded && isSignedIn) || isRedirecting) {
      return;
    }
    setIsRedirecting(true);
    window.location.replace(successRedirect);
  }, [isRedirecting, isSignedIn, isUserLoaded, successRedirect]);

  const errorPathFor = React.useCallback(
    (params: { errorCode?: string; error?: string }) => {
      const nextSearch = new URLSearchParams();
      if (params.errorCode) {
        nextSearch.set("errorCode", params.errorCode);
      } else if (params.error) {
        nextSearch.set("error", params.error);
      }
      if (redirectUrl) {
        nextSearch.set("redirect_url", redirectUrl);
      }
      return `/sign-up?${nextSearch.toString()}`;
    },
    [redirectUrl]
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
        setOtpError(authErrorMessage(mapped.errorCode));
        return { success: false };
      }
      setOtpError(mapped.message);
      return { success: false };
    },
    []
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
    if (!(trimmed && authReady) || submitting) {
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
      const signUpAttempt = await authSpan(
        "auth.signup.create",
        { mode: "sign-up" },
        () =>
          signUp.create({
            emailAddress: trimmed,
            legalAccepted: true,
          })
      );

      if (signUpAttempt.status === "complete" && signUpAttempt.createdSessionId) {
        await setActive({
          session: signUpAttempt.createdSessionId,
          navigate: makeFinalizeNavigate(successRedirect),
        });
        return;
      }

      await authSpan("auth.otp.send", { mode: "sign-up" }, () =>
        signUp.prepareEmailAddressVerification({ strategy: "email_code" })
      );

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
      if (!authReady) {
        return;
      }
      authBreadcrumb("OTP verification attempt", "info", { mode: "sign-up" });
      setIsVerifying(true);
      try {
        const signUpAttempt = await authSpan(
          "auth.otp.verify",
          { mode: "sign-up" },
          () => signUp.attemptEmailAddressVerification({ code: codeValue })
        );
        if (signUpAttempt.status === "complete" && signUpAttempt.createdSessionId) {
          authBreadcrumb("OTP verified", "info", { mode: "sign-up" });
          setIsRedirecting(true);
          await setActive({
            session: signUpAttempt.createdSessionId,
            navigate: makeFinalizeNavigate(successRedirect),
          });
        } else {
          verifyingCodeRef.current = null;
          setOtpError(
            "Sign-up could not be completed. Please try again or contact support."
          );
          setIsVerifying(false);
        }
      } catch (err) {
        authBreadcrumb("OTP verification failed", "warning", {
          mode: "sign-up",
        });
        verifyingCodeRef.current = null;
        const { success } = handleOtpClerkError(err);
        if (
          success &&
          signUp.status === "complete" &&
          signUp.createdSessionId
        ) {
          authBreadcrumb("OTP verified", "info", { mode: "sign-up" });
          setIsRedirecting(true);
          await setActive({
            session: signUp.createdSessionId,
            navigate: makeFinalizeNavigate(successRedirect),
          });
          return;
        }
        if (success) {
          setOtpError(
            "Sign-up could not be completed. Please try again or contact support."
          );
        }
        setIsVerifying(false);
      }
    },
    [authReady, signUp, setActive, handleOtpClerkError, successRedirect]
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
    if (!authReady) {
      return;
    }
    setIsResending(true);
    setOtpError(null);
    authBreadcrumb("OTP resend requested", "info", { mode: "sign-up" });
    try {
      await authSpan("auth.otp.send", { mode: "sign-up" }, () =>
        signUp.prepareEmailAddressVerification({ strategy: "email_code" })
      );
      authBreadcrumb("OTP code resent", "info", { mode: "sign-up" });
      toast.success("Verification code sent to your email");
      setCode("");
      verifyingCodeRef.current = null;
    } catch (err) {
      authBreadcrumb("OTP resend failed", "error", { mode: "sign-up" });
      handleOtpClerkError(err);
    }
    setIsResending(false);
  }, [authReady, signUp, handleOtpClerkError]);

  const onReset = React.useCallback(() => {
    window.location.replace(authPath("/sign-up", redirectUrl));
  }, [redirectUrl]);

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
            errorCode={search.errorCode}
            message={search.error}
            redirectUrl={redirectUrl}
          />
        )}

        {!hasError && view === "email" && (
          <>
            <form className="space-y-4" onSubmit={onSubmit}>
              <Input
                autoComplete="email"
                aria-label="Email Address"
                className="bg-background dark:bg-background"
                disabled={submitting || !authReady}
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
                  disabled={submitting || !authReady}
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
                  <a
                    className="text-foreground underline hover:text-foreground/80"
                    href="/legal/terms"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    className="text-foreground underline hover:text-foreground/80"
                    href="/legal/privacy"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Privacy Policy
                  </a>
                </label>
              </div>
              {legalError && (
                <p className="text-destructive text-sm" id="legal-error">
                  {legalError}
                </p>
              )}
              <Button
                aria-label="Continue with Email"
                className="w-full"
                disabled={submitting || !authReady}
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
            <Link search={authSearch(redirectUrl)} to="/sign-in">
              Log in
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
