"use client";

import { toast } from "@repo/ui/components/ui/sonner";
import { useSignIn, useSignUp } from "@vendor/clerk/client";
import * as React from "react";
import { consoleUrl } from "~/lib/related-projects";
import { CodeVerificationUI } from "./shared/code-verification-ui";

interface OTPIslandProps {
  email: string;
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

  const navigateToConsole = React.useCallback(() => {
    window.location.href = `${consoleUrl}/account/teams/new`;
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
        onError?.(
          "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
          true
        );
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
        // Invitation ticket flow — may auto-complete
        const { error: ticketError } = await signUp.ticket({ ticket });
        if (ticketError) {
          handleClerkError(ticketError);
          return;
        }
        if (signUp.status === "complete") {
          setIsRedirecting(true);
          await signUp.finalize({
            navigate: async () => navigateToConsole(),
          });
          return;
        }
        // Ticket didn't auto-complete — fall through to email code
      }

      if (mode === "sign-in") {
        const { error: sendError } = await signIn.emailCode.sendCode({
          emailAddress: email,
        });
        if (sendError) {
          handleClerkError(sendError);
        }
      } else {
        // Sign-up: create the account then send verification code
        const { error: createError } = await signUp.create({
          emailAddress: email,
          legalAccepted: true,
        });
        if (createError) {
          handleClerkError(createError);
          return;
        }
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) {
          handleClerkError(sendError);
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
      setIsVerifying(true);
      try {
        if (mode === "sign-in") {
          const { error: verifyError } = await signIn.emailCode.verifyCode({
            code,
          });
          if (verifyError) {
            handleClerkError(verifyError);
            setIsVerifying(false);
            return;
          }
          if (signIn.status === "complete") {
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
          const { error: verifyError } =
            await signUp.verifications.verifyEmailCode({ code });
          if (verifyError) {
            handleClerkError(verifyError);
            setIsVerifying(false);
            return;
          }
          if (signUp.status === "complete") {
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
          emailAddress: email,
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
      email={email}
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
