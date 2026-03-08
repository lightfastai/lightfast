"use client";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { useSignUp } from "@vendor/clerk/client";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { env } from "~/env";
import { OAuthSignUp } from "./oauth-sign-up";
import { SignUpCodeVerification } from "./sign-up-code-verification";
import { SignUpEmailInput } from "./sign-up-email-input";
import { SignUpPassword } from "./sign-up-password";

export function SignUpForm() {
  const searchParams = useSearchParams();
  const invitationTicket = searchParams.get("__clerk_ticket");
  const { signUp } = useSignUp();

  const [verificationStep, setVerificationStep] = React.useState<
    "email" | "code" | "password"
  >("email");
  const [emailAddress, setEmailAddress] = React.useState("");
  const [error, setError] = React.useState("");
  const [isWaitlistRestricted, setIsWaitlistRestricted] = React.useState(false);

  // Only show password sign-up in development and preview environments
  const showPasswordSignUp = env.NEXT_PUBLIC_VERCEL_ENV !== "production";

  // Check for waitlist error after OAuth redirect (e.g. SSO callback failure)
  React.useEffect(() => {
    const verificationError = signUp?.verifications.emailAddress.error;
    if (verificationError?.code === "sign_up_restricted_waitlist") {
      setError(
        verificationError.longMessage ??
          "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available."
      );
      setIsWaitlistRestricted(true);
    }
  }, [signUp]);

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

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Header - only show on email and password steps */}
      {(verificationStep === "email" || verificationStep === "password") && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Sign up for Lightfast
          </h1>
        </div>
      )}

      {/* Invitation info - show when ticket is present */}
      {invitationTicket && verificationStep === "email" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-blue-800 text-sm">
            You've been invited to join Lightfast. Complete sign-up below.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {error && !isWaitlistRestricted && (
          <div className="space-y-4">
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
          </div>
        )}

        {error && isWaitlistRestricted && (
          <div className="space-y-4">
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
              Back to Sign Up
            </Button>
          </div>
        )}

        {!error && verificationStep === "email" && (
          <>
            {/* Email Sign Up */}
            <SignUpEmailInput
              invitationTicket={invitationTicket}
              onError={handleError}
              onSuccess={handleEmailSuccess}
            />

            {/* Legal compliance text */}
            <p className="text-center text-muted-foreground text-sm">
              By joining, you agree to our{" "}
              <MicrofrontendLink
                className="text-foreground underline hover:text-foreground/80"
                href={"/legal/terms"}
                rel="noopener noreferrer"
                target="_blank"
              >
                Terms of Service
              </MicrofrontendLink>{" "}
              and{" "}
              <MicrofrontendLink
                className="text-foreground underline hover:text-foreground/80"
                href={"/legal/privacy"}
                rel="noopener noreferrer"
                target="_blank"
              >
                Privacy Policy
              </MicrofrontendLink>
            </p>

            {showPasswordSignUp && (
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

                {/* Password Sign Up Option */}
                <Button
                  className="w-full"
                  onClick={() => setVerificationStep("password")}
                  size="lg"
                  variant="outline"
                >
                  Sign up with Password
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

            {/* OAuth Sign Up */}
            <OAuthSignUp
              invitationTicket={invitationTicket}
              onError={handleError}
            />
          </>
        )}

        {!error && verificationStep === "password" && (
          <>
            <SignUpPassword
              onError={handleError}
              onSuccess={handleEmailSuccess}
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
          <SignUpCodeVerification
            email={emailAddress}
            onError={handleError}
            onReset={handleReset}
          />
        )}
      </div>

      {/* Sign In Link - only show on email step */}
      {verificationStep === "email" && (
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
