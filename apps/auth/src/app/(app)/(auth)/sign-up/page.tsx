import { Button } from "@repo/ui/components/ui/button";
import { createMetadata } from "@vendor/seo/metadata";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import NextLink from "next/link";
import type { SearchParams } from "nuqs/server";
import { EmailForm } from "../_components/email-form";
import { ErrorBanner } from "../_components/error-banner";
import { OAuthButton } from "../_components/oauth-button";
import { SeparatorWithText } from "../_components/separator-with-text";
import { loadSignUpSearchParams } from "../_lib/search-params";

const OTPIsland = dynamic(() =>
  import("../_components/otp-island").then((m) => m.OTPIsland)
);

function decodeTicketExpiry(ticket: string): Date | null {
  try {
    const segment = ticket.split(".")[1];
    if (!segment) {
      return null;
    }
    const payload = JSON.parse(
      atob(segment.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: unknown };
    return typeof payload.exp === "number"
      ? new Date(payload.exp * 1000)
      : null;
  } catch {
    return null;
  }
}

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

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function SignUpPage({ searchParams }: PageProps) {
  const { step, email, error, ticket, __clerk_ticket, waitlist } =
    await loadSignUpSearchParams(searchParams);

  // Support both ?ticket= (nuqs) and ?__clerk_ticket= (Clerk invitation URL)
  const invitationTicket = ticket ?? __clerk_ticket ?? null;

  const signUpBaseUrl = invitationTicket
    ? `/sign-up?__clerk_ticket=${encodeURIComponent(invitationTicket)}`
    : "/sign-up";

  const invitationExpiry = invitationTicket
    ? decodeTicketExpiry(invitationTicket)
    : null;

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Header — only on email step */}
      {step === "email" && !error && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            {invitationTicket
              ? "Accept Your Invitation"
              : "Sign up for Lightfast"}
          </h1>
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

        {/* Step: email */}
        {!error &&
          step === "email" &&
          (invitationTicket ? (
            // Invitation flow — GitHub primary, email form secondary
            <>
              <OAuthButton mode="sign-up" ticket={invitationTicket} />
              <SeparatorWithText text="Or" />
              <EmailForm action="sign-up" ticket={invitationTicket} />
              {invitationExpiry && (
                <p className="text-center text-muted-foreground text-xs">
                  Invitation expires{" "}
                  {invitationExpiry.toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </>
          ) : (
            // Standard waitlist sign-up — email form + GitHub secondary
            <>
              <EmailForm action="sign-up" ticket={null} />

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
              <OAuthButton mode="sign-up" ticket={null} />
            </>
          ))}

        {/* Step: code */}
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
