import { Icons } from "@repo/ui/components/icons";
import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata } from "next";
import { EarlyAccessForm } from "~/components/early-access-form";

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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Main Content - Centered */}
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {/* Logo Card */}
          <div className="w-fit rounded-sm bg-card p-3">
            <Icons.logoShort className="h-5 w-5 text-foreground" />
          </div>

          {/* Heading */}
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            Join the Early Access waitlist
          </h1>

          {/* Form */}
          <EarlyAccessForm
            initialCompanySize={initialCompanySize}
            initialEmail={initialEmail}
            initialSources={initialSources}
          />
        </div>
      </main>

      <div aria-hidden className="h-16 shrink-0 md:h-20" />
    </div>
  );
}
