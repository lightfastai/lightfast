import type { Metadata } from "next";
import { createMetadata } from "@vendor/seo/metadata";
import { Icons } from "@repo/ui/components/icons";
import { EarlyAccessForm } from "~/components/early-access-form";

export const metadata: Metadata = createMetadata({
  title: "Early Access – Lightfast",
  description:
    "Join the waitlist for early access to Lightfast. Be among the first to surface every decision your team makes across your tools — searchable, cited, and ready for people and agents.",
  openGraph: {
    title: "Early Access – Lightfast",
    description:
      "Sign up for early access to Lightfast. Surface every decision your team makes across your tools — searchable, cited, and ready for people and agents.",
    url: "https://lightfast.ai/early-access",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Early Access – Lightfast",
    description:
      "Join the early access list for Lightfast. Decisions surfaced across your tools.",
  },
  alternates: {
    canonical: "https://lightfast.ai/early-access",
  },
});

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    companySize?: string;
    sources?: string;
  }>;
}) {
  // Read search params for initial form state
  const params = await searchParams;
  const initialEmail = params.email ?? "";
  const initialCompanySize = params.companySize ?? "";
  const initialSources = params.sources ? params.sources.split(",") : [];
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content - Centered */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {/* Logo Card */}
          <div className="rounded-sm bg-card p-3 w-fit">
            <Icons.logoShort className="h-5 w-5 text-foreground" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl pb-4 font-pp font-medium text-foreground">
            Join the Early Access waitlist
          </h1>

          {/* Form */}
          <EarlyAccessForm
            initialEmail={initialEmail}
            initialCompanySize={initialCompanySize}
            initialSources={initialSources}
          />
        </div>
      </main>

      <div aria-hidden className="shrink-0 h-16 md:h-20" />
    </div>
  );
}
