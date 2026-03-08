"use client";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { useSignIn } from "@vendor/clerk/client";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import * as React from "react";
import { env } from "~/env";
import { consoleUrl } from "~/lib/related-projects";
import { OAuthSignIn } from "./oauth-sign-in";
import { SignInCodeVerification } from "./sign-in-code-verification";
import { SignInEmailInput } from "./sign-in-email-input";
import { SignInPassword } from "./sign-in-password";

interface SignInFormProps {
  onVerificationStepChange?: (step: "email" | "code" | "password") => void;
  verificationStep?: "email" | "code" | "password";
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
          "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available."
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
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Log in to Lightfast
          </h1>
        </div>
      )}

      <div className="space-y-4">
        {error && !isWaitlistRestricted && (
          <>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
            <Button
              className="w-full"
              onClick={handleReset}
              size="lg"
              variant="outline"
            >
              Try again
            </Button>
          </>
        )}

        {error && isWaitlistRestricted && (
          <>
            <div className="rounded-lg border border-border bg-destructive/30 p-3">
              <p className="text-foreground text-sm">{error}</p>
            </div>
            <Button asChild className="w-full" size="lg">
              <MicrofrontendLink href="/early-access">
                Join the Waitlist
              </MicrofrontendLink>
            </Button>
            <Button
              className="w-full"
              onClick={handleReset}
              size="lg"
              variant="outline"
            >
              Back to Sign In
            </Button>
          </>
        )}

        {!error && verificationStep === "email" && (
          <>
            {/* Email Sign In */}
            <SignInEmailInput
              onError={handleError}
              onSuccess={handleEmailSuccess}
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
                  className="w-full"
                  onClick={() => setVerificationStep("password")}
                  size="lg"
                  variant="outline"
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
              onError={handleError}
              onSuccess={handlePasswordSuccess}
            />

            <Button
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={handleReset}
              size="lg"
              variant="ghost"
            >
              ← Back to other options
            </Button>
          </>
        )}

        {!error && verificationStep === "code" && (
          <SignInCodeVerification email={emailAddress} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
