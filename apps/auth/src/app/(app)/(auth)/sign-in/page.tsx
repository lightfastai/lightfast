import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { EmailForm } from "../_components/email-form";
import { ErrorBanner } from "../_components/error-banner";
import { OAuthButton } from "../_components/oauth-button";
import { OTPIsland } from "../_components/otp-island";
import { SeparatorWithText } from "../_components/separator-with-text";
import { SessionActivator } from "../_components/session-activator";
import { loadSignInSearchParams } from "../_lib/search-params";

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

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const { step, email, error, token, waitlist } =
    await loadSignInSearchParams(searchParams);

  return (
    <div className="w-full space-y-8">
      {/* Header — only on email step */}
      {step === "email" && !error && (
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
            <SeparatorWithText text="Or" />
            <OAuthButton mode="sign-in" />
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
