"use client";

import { toast } from "@repo/ui/components/ui/sonner";
import { addBreadcrumb, startSpan } from "@sentry/nextjs";
import { useSignIn, useSignUp } from "@vendor/clerk/client";
import * as React from "react";
import { CodeVerificationUI } from "./shared/code-verification-ui";

interface OTPIslandProps {
  email: string | null;
  mode: "sign-in" | "sign-up";
  onError?: (message: string, isWaitlist?: boolean) => void;
  ticket?: string | null;
}

export function OTPIsland({ email, mode, ticket, onError }: OTPIslandProps) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(true);
  // Tracks the display email — seeded from prop, populated from Clerk on ticket-only path
  const [resolvedEmail, setResolvedEmail] = React.useState<string | null>(
    email
  );

  const navigateToConsole = React.useCallback(() => {
    window.location.href = "/account/welcome";
  }, []);

  const handleClerkError = React.useCallback(
    (
      clerkError: {
        code: string;
        message?: string;
        longMessage?: string;
      } | null
    ) => {
      if (!clerkError) {
        return;
      }
      const errCode = clerkError.code;

      if (errCode === "too_many_requests") {
        setError("Too many attempts. Please wait a moment and try again.");
        return;
      }
      if (errCode === "user_locked") {
        setError("Account locked. Please try again later.");
        return;
      }
      if (errCode === "sign_up_restricted_waitlist") {
        const msg =
          "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.";
        if (onError) {
          onError(msg, true);
        } else {
          window.location.href = `/sign-up?error=${encodeURIComponent(msg)}&waitlist=true`;
        }
        return;
      }
      setError(
        clerkError.longMessage ?? clerkError.message ?? "Verification failed"
      );
    },
    [onError]
  );

  const hasInitRef = React.useRef(false);
  const verifyingCodeRef = React.useRef<string | null>(null);

  // Send OTP on mount (or handle ticket)
  React.useEffect(() => {
    if (hasInitRef.current) {
      return;
    }
    hasInitRef.current = true;

    async function init() {
      if (mode === "sign-up" && ticket) {
        // Invitation ticket flow: create sign-up with ticket + email + legal in one call.
        // ticket bypasses waitlist; emailAddress is whatever the user wants (not required to
        // match the invited address); legalAccepted satisfies the legal_accepted requirement.
        const { error: createError } = await signUp.create({
          ticket,
          emailAddress: email ?? undefined,
          legalAccepted: true,
        });
        if (createError) {
          handleClerkError(createError);
          return;
        }
        if (signUp.status === "complete") {
          setIsRedirecting(true);
          await signUp.finalize({
            navigate: async () => navigateToConsole(),
          });
          return;
        }
        setResolvedEmail(signUp.emailAddress ?? email);
        // Email verification required — send OTP now
        const { error: sendError } = await startSpan(
          { name: "auth.otp.send", op: "auth", attributes: { mode } },
          () => signUp.verifications.sendEmailCode()
        );
        if (sendError) {
          addBreadcrumb({
            category: "auth",
            message: "OTP send failed",
            level: "error",
            data: { code: sendError.code, mode },
          });
          handleClerkError(sendError);
        } else {
          addBreadcrumb({
            category: "auth",
            message: "OTP code sent",
            level: "info",
            data: { mode, email },
          });
        }
        return;
      }

      if (mode === "sign-in") {
        const { error: sendError } = await startSpan(
          { name: "auth.otp.send", op: "auth", attributes: { mode } },
          () => signIn.emailCode.sendCode({ emailAddress: email ?? undefined })
        );
        if (sendError) {
          addBreadcrumb({
            category: "auth",
            message: "OTP send failed",
            level: "error",
            data: { code: sendError.code, mode },
          });
          handleClerkError(sendError);
        } else {
          addBreadcrumb({
            category: "auth",
            message: "OTP code sent",
            level: "info",
            data: { mode, email },
          });
        }
      } else {
        // Sign-up: create the account then send verification code
        const { error: createError } = await signUp.create({
          emailAddress: email ?? undefined,
          legalAccepted: true,
        });
        if (createError) {
          handleClerkError(createError);
          return;
        }
        const { error: sendError } = await startSpan(
          { name: "auth.otp.send", op: "auth", attributes: { mode } },
          () => signUp.verifications.sendEmailCode()
        );
        if (sendError) {
          addBreadcrumb({
            category: "auth",
            message: "OTP send failed",
            level: "error",
            data: { code: sendError.code, mode },
          });
          handleClerkError(sendError);
        } else {
          addBreadcrumb({
            category: "auth",
            message: "OTP code sent",
            level: "info",
            data: { mode, email },
          });
        }
      }
    }
    init()
      .catch(() => {
        setError("An unexpected error occurred. Please try again.");
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [
    email,
    mode,
    ticket,
    signIn,
    signUp,
    handleClerkError,
    navigateToConsole,
  ]);

  // Auto-verify when 6 digits entered
  React.useEffect(() => {
    if (code.length !== 6 || error || isInitializing) {
      return;
    }
    if (verifyingCodeRef.current === code) {
      return; // Already verifying this exact code
    }
    verifyingCodeRef.current = code;

    async function verify() {
      addBreadcrumb({
        category: "auth",
        message: "OTP verification attempt",
        level: "info",
        data: { mode },
      });
      setIsVerifying(true);
      try {
        if (mode === "sign-in") {
          const { error: verifyError } = await startSpan(
            { name: "auth.otp.verify", op: "auth", attributes: { mode } },
            () => signIn.emailCode.verifyCode({ code })
          );
          if (verifyError) {
            addBreadcrumb({
              category: "auth",
              message: "OTP verification failed",
              level: "warning",
              data: { code: verifyError.code, mode },
            });
            handleClerkError(verifyError);
            setIsVerifying(false);
            return;
          }
          if (signIn.status === "complete") {
            addBreadcrumb({
              category: "auth",
              message: "OTP verified",
              level: "info",
              data: { mode },
            });
            setIsRedirecting(true);
            await signIn.finalize({
              navigate: async () => navigateToConsole(),
            });
          } else {
            setError(
              "Sign-in could not be completed. Please try again or contact support."
            );
            setIsVerifying(false);
          }
        } else {
          const { error: verifyError } = await startSpan(
            { name: "auth.otp.verify", op: "auth", attributes: { mode } },
            () => signUp.verifications.verifyEmailCode({ code })
          );
          if (verifyError) {
            addBreadcrumb({
              category: "auth",
              message: "OTP verification failed",
              level: "warning",
              data: { code: verifyError.code, mode },
            });
            handleClerkError(verifyError);
            setIsVerifying(false);
            return;
          }
          if (signUp.status === "complete") {
            addBreadcrumb({
              category: "auth",
              message: "OTP verified",
              level: "info",
              data: { mode },
            });
            setIsRedirecting(true);
            await signUp.finalize({
              navigate: async () => navigateToConsole(),
            });
          } else {
            setError(
              "Sign-up could not be completed. Please try again or contact support."
            );
            setIsVerifying(false);
          }
        }
      } catch {
        setError("An unexpected error occurred. Please try again.");
        setIsVerifying(false);
      }
    }
    verify();
  }, [
    code,
    error,
    isInitializing,
    mode,
    signIn,
    signUp,
    handleClerkError,
    navigateToConsole,
  ]);

  async function handleResendCode() {
    setIsResending(true);
    setError(null);
    try {
      if (mode === "sign-in") {
        const { error: sendError } = await signIn.emailCode.sendCode({
          emailAddress: email ?? undefined,
        });
        if (sendError) {
          handleClerkError(sendError);
        } else {
          toast.success("Verification code sent to your email");
          setCode("");
        }
      } else {
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) {
          handleClerkError(sendError);
        } else {
          toast.success("Verification code sent to your email");
          setCode("");
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    }
    setIsResending(false);
  }

  function handleCodeChange(value: string) {
    setError(null);
    if (value.length < 6) {
      verifyingCodeRef.current = null;
    }
    setCode(value);
  }

  function handleReset() {
    if (mode === "sign-in") {
      window.location.href = "/sign-in";
    } else {
      const ticketParam = ticket
        ? `?__clerk_ticket=${encodeURIComponent(ticket)}`
        : "";
      window.location.href = `/sign-up${ticketParam}`;
    }
  }

  return (
    <CodeVerificationUI
      code={code}
      email={resolvedEmail}
      inlineError={error}
      isRedirecting={isRedirecting}
      isResending={isResending}
      isVerifying={isVerifying}
      onCodeChange={handleCodeChange}
      onResend={handleResendCode}
      onReset={handleReset}
    />
  );
}
