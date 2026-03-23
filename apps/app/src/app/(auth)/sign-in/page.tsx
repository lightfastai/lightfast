import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import type { SearchParams } from "nuqs/server";
import { EmailForm } from "../_components/email-form";
import { ErrorBanner } from "../_components/error-banner";
import { OAuthButton } from "../_components/oauth-button";
import { SeparatorWithText } from "../_components/separator-with-text";
import { loadSignInSearchParams } from "../_lib/search-params";

const OTPIsland = dynamic(() =>
  import("../_components/otp-island").then((m) => m.OTPIsland)
);
const SessionActivator = dynamic(() =>
  import("../_components/session-activator").then((m) => m.SessionActivator)
);

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
  const { step, email, error, token, errorCode } =
    await loadSignInSearchParams(searchParams);

  const hasError = !!(error ?? errorCode);

  return (
    <div className="w-full space-y-8">
      {step === "email" && !hasError && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Log in to Lightfast
          </h1>
        </div>
      )}

      <div className="space-y-4">
        {(error ?? errorCode) && (
          <ErrorBanner
            backUrl="/sign-in"
            errorCode={errorCode}
            message={error}
          />
        )}

        {!hasError && step === "email" && (
          <>
            <EmailForm action="sign-in" />
            <SeparatorWithText text="Or" />
            <OAuthButton mode="sign-in" />
          </>
        )}

        {!hasError && step === "code" && email && (
          <OTPIsland email={email} mode="sign-in" />
        )}

        {step === "activate" && token && <SessionActivator token={token} />}
      </div>
    </div>
  );
}
