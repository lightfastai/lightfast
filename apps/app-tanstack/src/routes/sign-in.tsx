import { useUser } from "@clerk/tanstack-react-start";
import { useSignIn } from "@clerk/tanstack-react-start/legacy";
import type {
  SignInFirstFactor,
  SignInResource,
} from "@clerk/tanstack-react-start/types";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
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
type EmailCodeFirstFactor = Extract<
  SignInFirstFactor,
  { strategy: "email_code" }
>;

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

function getEmailCodeFactor(
  signInResource: SignInResource
): EmailCodeFirstFactor | null {
  return (
    signInResource.supportedFirstFactors?.find(
      (factor): factor is EmailCodeFirstFactor =>
        factor.strategy === "email_code"
    ) ?? null
  );
}

function validateSignInSearch(search: Record<string, unknown>) {
  const error = parseAuthErrorMessage(search.error);
  const errorCode = parseAuthErrorCode(search.errorCode);
  const redirectUrl = parseSafeAuthRedirectTarget(search.redirect_url);

  return {
    ...(error ? { error } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
  };
}

export const Route = createFileRoute("/sign-in")({
  validateSearch: validateSignInSearch,
  head: () => ({
    meta: [
      { title: "Sign In - Lightfast Auth" },
      {
        name: "description",
        content:
          "Sign in to your Lightfast account to access the AI agent platform.",
      },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  return (
    <AuthShell>
      <SignInView />
    </AuthShell>
  );
}

function SignInView() {
  const {
    isLoaded: isSignInLoaded,
    setActive,
    signIn,
  } = useSignIn();
  const { isLoaded: isUserLoaded, isSignedIn } = useUser();
  const search = Route.useSearch();
  const redirectUrl = search.redirect_url;
  const successRedirect = redirectUrl ?? SUCCESS_REDIRECT;
  const hasError = !!(search.error ?? search.errorCode);
  const authReady = isSignInLoaded && !!signIn;

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
      return `/sign-in?${nextSearch.toString()}`;
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
    setSubmitting(true);

    try {
      const signInAttempt = await authSpan(
        "auth.sign-in.create",
        { mode: "sign-in" },
        () => signIn.create({ identifier: trimmed })
      );
      const emailCodeFactor = getEmailCodeFactor(signInAttempt);
      if (!emailCodeFactor) {
        throw new Error("Email code sign-in is not available.");
      }
      await authSpan("auth.otp.send", { mode: "sign-in" }, () =>
        signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailCodeFactor.emailAddressId,
        })
      );
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
      if (!authReady) {
        return;
      }
      authBreadcrumb("OTP verification attempt", "info", { mode: "sign-in" });
      setIsVerifying(true);
      try {
        const signInAttempt = await authSpan(
          "auth.otp.verify",
          { mode: "sign-in" },
          () =>
            signIn.attemptFirstFactor({
              strategy: "email_code",
              code: codeValue,
            })
        );
        if (signInAttempt.status === "complete" && signInAttempt.createdSessionId) {
          authBreadcrumb("OTP verified", "info", { mode: "sign-in" });
          setIsRedirecting(true);
          await setActive({
            session: signInAttempt.createdSessionId,
            navigate: makeFinalizeNavigate(successRedirect),
          });
        } else {
          verifyingCodeRef.current = null;
          setOtpError(
            "Sign-in could not be completed. Please try again or contact support."
          );
          setIsVerifying(false);
        }
      } catch (err) {
        authBreadcrumb("OTP verification failed", "warning", {
          mode: "sign-in",
        });
        verifyingCodeRef.current = null;
        const { success } = handleOtpClerkError(err);
        if (
          success &&
          signIn.status === "complete" &&
          signIn.createdSessionId
        ) {
          authBreadcrumb("OTP verified", "info", { mode: "sign-in" });
          setIsRedirecting(true);
          await setActive({
            session: signIn.createdSessionId,
            navigate: makeFinalizeNavigate(successRedirect),
          });
          return;
        }
        if (success) {
          setOtpError(
            "Sign-in could not be completed. Please try again or contact support."
          );
        }
        setIsVerifying(false);
      }
    },
    [authReady, signIn, setActive, handleOtpClerkError, successRedirect]
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
    authBreadcrumb("OTP resend requested", "info", { mode: "sign-in" });
    try {
      const emailCodeFactor = getEmailCodeFactor(signIn);
      if (!emailCodeFactor) {
        throw new Error("Email code sign-in is not available.");
      }
      await authSpan("auth.otp.send", { mode: "sign-in" }, () =>
        signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailCodeFactor.emailAddressId,
        })
      );
      authBreadcrumb("OTP code resent", "info", { mode: "sign-in" });
      toast.success("Verification code sent to your email");
      setCode("");
      verifyingCodeRef.current = null;
    } catch (err) {
      authBreadcrumb("OTP resend failed", "error", { mode: "sign-in" });
      handleOtpClerkError(err);
    }
    setIsResending(false);
  }, [authReady, signIn, handleOtpClerkError]);

  const onReset = React.useCallback(() => {
    window.location.replace(authPath("/sign-in", redirectUrl));
  }, [redirectUrl]);

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
            errorCode={search.errorCode}
            message={search.error}
            redirectUrl={redirectUrl}
          />
        )}

        {!hasError && view === "email" && (
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

      {view === "email" && !hasError && (
        <div className="text-center text-sm">
          <span className="text-muted-foreground">
            Don&apos;t have an account?{" "}
          </span>
          <Button
            asChild
            className="inline-flex h-auto rounded-none p-0 text-sm"
            variant="link-blue"
          >
            <Link search={authSearch(redirectUrl)} to="/sign-up">
              Sign up
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
