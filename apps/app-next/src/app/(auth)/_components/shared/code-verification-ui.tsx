"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@repo/ui/components/ui/input-otp";
import { AlertCircle, ArrowLeft } from "lucide-react";

interface CodeVerificationUIProps {
  code: string;
  email: string | null;
  inlineError: string | null;
  isRedirecting: boolean;
  isResending: boolean;
  isVerifying: boolean;
  onCodeChange: (value: string) => void;
  onResend: () => void;
  onReset: () => void;
  title?: string;
}

export function CodeVerificationUI({
  email,
  code,
  onCodeChange,
  isVerifying,
  isRedirecting,
  isResending,
  inlineError,
  onResend,
  onReset,
  title = "Verification",
}: CodeVerificationUIProps) {
  return (
    <div className="w-full space-y-8">
      {/* Header - matches sign-in/sign-up styling */}
      <div className="text-center">
        <h1 className="font-semibold text-3xl text-foreground">{title}</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {email ? (
            <>
              We sent a verification code to{" "}
              <span className="font-medium">{email}</span>
            </>
          ) : (
            "Enter the verification code from your email"
          )}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          <InputOTP
            aria-invalid={!!inlineError}
            containerClassName="gap-2"
            disabled={isVerifying || isRedirecting}
            maxLength={6}
            onChange={onCodeChange}
            value={code}
          >
            <InputOTPGroup className="gap-2">
              <InputOTPSlot
                className="!rounded-none first:!rounded-none border dark:bg-transparent"
                index={0}
              />
              <InputOTPSlot
                className="!rounded-none border dark:bg-transparent"
                index={1}
              />
              <InputOTPSlot
                className="!rounded-none border dark:bg-transparent"
                index={2}
              />
              <InputOTPSlot
                className="!rounded-none border dark:bg-transparent"
                index={3}
              />
              <InputOTPSlot
                className="!rounded-none border dark:bg-transparent"
                index={4}
              />
              <InputOTPSlot
                className="!rounded-none last:!rounded-none border dark:bg-transparent"
                index={5}
              />
            </InputOTPGroup>
          </InputOTP>

          {/* Inline error message */}
          {inlineError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{inlineError}</span>
            </div>
          )}

          {/* Loading state */}
          {(isVerifying || isRedirecting) && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Icons.spinner className="h-4 w-4 animate-spin" />
              <span>{isRedirecting ? "Redirecting..." : "Verifying..."}</span>
            </div>
          )}
        </div>

        {/* Back button */}
        <Button
          className="w-full rounded-none"
          disabled={isVerifying || isRedirecting}
          onClick={onReset}
          size="lg"
          variant="link-blue"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Resend code */}
        <div className="text-center text-muted-foreground text-sm">
          Didn't receive your code?{" "}
          <Button
            className="inline-flex h-auto rounded-none p-0"
            disabled={isResending || isVerifying || isRedirecting}
            onClick={onResend}
            variant="link-blue"
          >
            {isResending && <Icons.spinner className="h-3 w-3 animate-spin" />}
            Resend
          </Button>
        </div>
      </div>
    </div>
  );
}
