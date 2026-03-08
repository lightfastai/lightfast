import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata } from "next";
import { env } from "~/env";
import { EmailForm } from "../_components/email-form";
import { ErrorBanner } from "../_components/error-banner";
import { OAuthButton } from "../_components/oauth-button";
import { OTPIsland } from "../_components/otp-island";
import { PasswordForm } from "../_components/password-form";
import { SessionActivator } from "../_components/session-activator";
import { signInSearchParams } from "../_lib/search-params";

export const metadata: Metadata = createMetadata({
  title: "Sign In - Lightfast Auth",
  description:
    "Sign in to your Lightfast account to access the AI agent platform. Secure authentication portal for developers.",
  openGraph: {
    title: "Sign In - Lightfast Auth",
    description:
      "Sign in to your Lightfast account to access the AI agent platform.",
    url: "https://lightfast.ai/sign-in",
  },
  twitter: {
    title: "Sign In - Lightfast Auth",
    description:
      "Sign in to your Lightfast account to access the AI agent platform.",
  },
  alternates: {
    canonical: "https://lightfast.ai/sign-in",
  },
  robots: {
    index: true,
    follow: false,
  },
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { step, email, error, token, waitlist } =
    await signInSearchParams.parse(searchParams);

  const showPasswordSignIn = env.NEXT_PUBLIC_VERCEL_ENV !== "production";

  return (
    <div className="w-full space-y-8">
      {/* Header — only on email and password steps */}
      {(step === "email" || step === "password") && !error && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Log in to Lightfast
          </h1>
        </div>
      )}

      <div className="space-y-4">
        {/* Error display */}
        {error && (
          <ErrorBanner
            backUrl="/sign-in"
            isWaitlist={waitlist === "true"}
            message={error}
          />
        )}

        {/* Step: email — server component form + client OAuth island */}
        {!error && step === "email" && (
          <>
            <EmailForm action="sign-in" />

            {showPasswordSignIn && (
              <>
                <SeparatorWithText text="Or" />
                <Button asChild className="w-full" size="lg" variant="outline">
                  <a href="/sign-in?step=password">Sign in with Password</a>
                </Button>
              </>
            )}

            <SeparatorWithText text="Or" />
            <OAuthButton mode="sign-in" />
          </>
        )}

        {/* Step: password — server component form (dev/preview only) */}
        {!error && step === "password" && (
          <>
            <PasswordForm />
            <Button
              asChild
              className="w-full text-muted-foreground hover:text-foreground"
              size="lg"
              variant="ghost"
            >
              <a href="/sign-in">← Back to other options</a>
            </Button>
          </>
        )}

        {/* Step: code — client island (irreducible: OTP + Clerk FAPI) */}
        {!error && step === "code" && email && (
          <OTPIsland email={email} mode="sign-in" />
        )}

        {/* Step: activate — thin client island for session creation */}
        {step === "activate" && token && <SessionActivator token={token} />}
      </div>
    </div>
  );
}

function SeparatorWithText({ text }: { text: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <Separator className="w-full" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}
