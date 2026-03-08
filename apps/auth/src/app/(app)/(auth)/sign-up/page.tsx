import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { createMetadata } from "@vendor/seo/metadata";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import type { Metadata } from "next";
import NextLink from "next/link";
import { EmailForm } from "../_components/email-form";
import { ErrorBanner } from "../_components/error-banner";
import { OAuthButton } from "../_components/oauth-button";
import { OTPIsland } from "../_components/otp-island";
import { signUpSearchParams } from "../_lib/search-params";

export const metadata: Metadata = createMetadata({
  title: "Sign Up - Lightfast Auth",
  description:
    "Create your Lightfast account to access the AI agent platform. Secure sign-up portal for developers.",
  openGraph: {
    title: "Sign Up - Lightfast Auth",
    description:
      "Create your Lightfast account to access the AI agent platform.",
    url: "https://lightfast.ai/sign-up",
  },
  twitter: {
    title: "Sign Up - Lightfast Auth",
    description:
      "Create your Lightfast account to access the AI agent platform.",
  },
  alternates: {
    canonical: "https://lightfast.ai/sign-up",
  },
  robots: {
    index: true,
    follow: false,
  },
});

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { step, email, error, ticket, __clerk_ticket, waitlist } =
    await signUpSearchParams.parse(searchParams);

  // Support both ?ticket= (nuqs) and ?__clerk_ticket= (Clerk invitation URL)
  const invitationTicket = ticket ?? __clerk_ticket ?? null;

  const signUpBaseUrl = invitationTicket
    ? `/sign-up?__clerk_ticket=${encodeURIComponent(invitationTicket)}`
    : "/sign-up";

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Header — only on email step */}
      {step === "email" && !error && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Sign up for Lightfast
          </h1>
        </div>
      )}

      {/* Invitation info */}
      {invitationTicket && step === "email" && !error && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-blue-800 text-sm">
            You've been invited to join Lightfast. Complete sign-up below.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Error display */}
        {error && (
          <ErrorBanner
            backUrl={signUpBaseUrl}
            isWaitlist={waitlist === "true"}
            message={error}
          />
        )}

        {/* Step: email — server component form + OAuth */}
        {!error && step === "email" && (
          <>
            <EmailForm action="sign-up" ticket={invitationTicket} />

            {/* Legal compliance */}
            <p className="text-center text-muted-foreground text-sm">
              By joining, you agree to our{" "}
              <MicrofrontendLink
                className="text-foreground underline hover:text-foreground/80"
                href="/legal/terms"
                rel="noopener noreferrer"
                target="_blank"
              >
                Terms of Service
              </MicrofrontendLink>{" "}
              and{" "}
              <MicrofrontendLink
                className="text-foreground underline hover:text-foreground/80"
                href="/legal/privacy"
                rel="noopener noreferrer"
                target="_blank"
              >
                Privacy Policy
              </MicrofrontendLink>
            </p>

            <SeparatorWithText text="Or" />
            <OAuthButton mode="sign-up" ticket={invitationTicket} />
          </>
        )}

        {/* Step: code — client island (irreducible: OTP + Clerk FAPI) */}
        {!error && step === "code" && email && (
          <OTPIsland email={email} mode="sign-up" ticket={invitationTicket} />
        )}
      </div>

      {/* Sign In Link — only on email step */}
      {step === "email" && !error && (
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
