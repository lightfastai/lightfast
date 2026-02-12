"use client";
import * as React from "react";
import { useSignIn } from "@clerk/nextjs";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { SignInEmailInput } from "./sign-in-email-input";
import { SignInCodeVerification } from "./sign-in-code-verification";
import { SignInPassword } from "./sign-in-password";
import { OAuthSignIn } from "./oauth-sign-in";
import { consoleUrl } from "~/lib/related-projects";
import { env } from "~/env";

interface SignInFormProps {
  verificationStep?: "email" | "code" | "password";
  onVerificationStepChange?: (step: "email" | "code" | "password") => void;
}

export function SignInForm({
  verificationStep: controlledStep,
  onVerificationStepChange,
}: SignInFormProps = {}) {
  const { signIn } = useSignIn();
  const [internalStep, setInternalStep] = React.useState<
    "email" | "code" | "password"
  >("email");
  const verificationStep = controlledStep ?? internalStep;
  const setVerificationStep = onVerificationStepChange ?? setInternalStep;

  const [emailAddress, setEmailAddress] = React.useState("");
  const [error, setError] = React.useState("");
  const [isWaitlistRestricted, setIsWaitlistRestricted] = React.useState(false);

  // Only show password sign-in in development and preview environments
  const showPasswordSignIn = env.NEXT_PUBLIC_VERCEL_ENV !== "production";

  // Check for waitlist error after OAuth redirect
  React.useEffect(() => {
    const verificationError = signIn?.firstFactorVerification.error;
    if (verificationError?.code === "sign_up_restricted_waitlist") {
      setError(
        verificationError.longMessage ??
          "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
      );
      setIsWaitlistRestricted(true);
    }
  }, [signIn]);

  function handleEmailSuccess(email: string) {
    setEmailAddress(email);
    setVerificationStep("code");
    setError("");
  }

  function handleReset() {
    setVerificationStep("email");
    setError("");
    setEmailAddress("");
    setIsWaitlistRestricted(false);
  }

  function handleError(errorMessage: string, isSignUpRestricted = false) {
    setError(errorMessage);
    setIsWaitlistRestricted(isSignUpRestricted);
  }

  function handlePasswordSuccess() {
    // Password sign-in is complete, redirect to team creation
    setError("");
    window.location.href = `${consoleUrl}/account/teams/new`;
  }

  return (
    <div className="w-full space-y-8">
      {/* Header - only show on email and password steps */}
      {(verificationStep === "email" || verificationStep === "password") && (
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-foreground">
            Log in to Lightfast
          </h1>
        </div>
      )}

      <div className="space-y-4">
        {error && !isWaitlistRestricted && (
          <>
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <Button
              onClick={handleReset}
              size="lg"
              variant="outline"
              className="w-full"
            >
              Try again
            </Button>
          </>
        )}

        {error && isWaitlistRestricted && (
          <>
            <div className="rounded-lg bg-destructive/30 border border-border p-3">
              <p className="text-sm text-foreground">{error}</p>
            </div>
            <Button asChild size="lg" className="w-full">
              <MicrofrontendLink href="/early-access">
                Join the Waitlist
              </MicrofrontendLink>
            </Button>
            <Button
              onClick={handleReset}
              size="lg"
              variant="outline"
              className="w-full"
            >
              Back to Sign In
            </Button>
          </>
        )}

        {!error && verificationStep === "email" && (
          <>
            {/* Email Sign In */}
            <SignInEmailInput
              onSuccess={handleEmailSuccess}
              onError={handleError}
            />

            {showPasswordSignIn && (
              <>
                {/* Separator */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>

                {/* Password Sign In Option */}
                <Button
                  variant="outline"
                  onClick={() => setVerificationStep("password")}
                  className="w-full"
                  size="lg"
                >
                  Sign in with Password
                </Button>
              </>
            )}

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            {/* OAuth Sign In */}
            <OAuthSignIn onError={handleError} />
          </>
        )}

        {!error && verificationStep === "password" && (
          <>
            <SignInPassword
              onSuccess={handlePasswordSuccess}
              onError={handleError}
            />

            <Button
              variant="ghost"
              onClick={handleReset}
              size="lg"
              className="w-full text-muted-foreground hover:text-foreground"
            >
              ← Back to other options
            </Button>
          </>
        )}

        {!error && verificationStep === "code" && (
          <SignInCodeVerification
            email={emailAddress}
            onReset={handleReset}
            onError={handleError}
          />
        )}
      </div>
    </div>
  );
}
