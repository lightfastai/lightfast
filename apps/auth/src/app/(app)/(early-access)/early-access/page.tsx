import { Icons } from "@repo/ui/components/icons";
import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { ConfettiWrapper } from "../_components/confetti-wrapper";
import { EarlyAccessErrorBanner } from "../_components/error-banner";
import { EarlyAccessFormServer } from "../_components/early-access-form-server";
import { loadEarlyAccessSearchParams } from "../_lib/search-params";

export const metadata: Metadata = createMetadata({
  title: "Early Access – Lightfast",
  description:
    "Get early access to the operating layer between your agents and apps. Connect your tools, observe events in real time, and give agents a single system to operate through.",
  openGraph: {
    title: "Early Access – Lightfast",
    description:
      "Get early access to the operating layer between your agents and apps. Observe events, build memory, and act across your entire tool stack.",
    url: "https://lightfast.ai/early-access",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Early Access – Lightfast",
    description: "Get early access to the operating layer for agents and apps.",
  },
  alternates: {
    canonical: "https://lightfast.ai/early-access",
  },
});

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const {
    email,
    companySize,
    sources,
    error,
    emailError,
    companySizeError,
    sourcesError,
    isRateLimit,
    success,
  } = await loadEarlyAccessSearchParams(searchParams);

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="w-fit rounded-sm bg-card p-3">
        <Icons.logoShort className="h-5 w-5 text-foreground" />
      </div>

      {success ? (
        <>
          <ConfettiWrapper />
          <div className="fade-in slide-in-from-bottom-4 animate-in space-y-4 duration-300">
            <div className="space-y-2">
              <h2 className="font-semibold text-2xl text-foreground">
                You're in!
              </h2>
              <p className="text-muted-foreground text-sm">
                Successfully joined early access! We'll send you an invite
                when Lightfast is ready.
              </p>
            </div>
            {email && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-muted-foreground text-sm">
                  We'll send updates to{" "}
                  <span className="font-medium text-foreground">
                    {email}
                  </span>
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            Join the Early Access waitlist
          </h1>

          {error && (
            <EarlyAccessErrorBanner isRateLimit={isRateLimit} message={error} />
          )}

          <EarlyAccessFormServer
            companySizeError={companySizeError}
            emailError={emailError}
            initialCompanySize={companySize}
            initialEmail={email}
            initialSources={
              sources ? sources.split(",").filter(Boolean) : []
            }
            sourcesError={sourcesError}
          />
        </>
      )}
    </div>
  );
}
