"use client";

import { useAuthFlow } from "../_hooks/use-auth-flow";
import { CodeVerificationUI } from "./shared/code-verification-ui";

interface OTPIslandProps {
  email: string | null;
  mode: "sign-in" | "sign-up";
  onWaitlistError?: () => void;
  ticket?: string | null;
}

export function OTPIsland({
  email,
  mode,
  ticket,
  onWaitlistError,
}: OTPIslandProps) {
  const { otp } = useAuthFlow({
    mode,
    step: "code",
    email,
    ticket,
    onWaitlistError,
  });

  return (
    <CodeVerificationUI
      code={otp.code}
      email={otp.email}
      inlineError={otp.error}
      isRedirecting={otp.isRedirecting}
      isResending={otp.isResending}
      isVerifying={otp.isVerifying}
      onCodeChange={otp.onCodeChange}
      onResend={otp.onResend}
      onReset={otp.onReset}
    />
  );
}
