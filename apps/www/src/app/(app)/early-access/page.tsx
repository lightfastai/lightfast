import type { Metadata } from "next";
import Image from "next/image";
import { createMetadata } from "@vendor/seo/metadata";
import { Icons } from "@repo/ui/components/icons";
import { EarlyAccessForm } from "~/components/early-access/early-access-form";
import { EarlyAccessFormProvider } from "~/components/early-access/early-access-form-provider";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = createMetadata({
  title: "Early Access - AI Workflow Automation Platform",
  description:
    "Join the waitlist for early access to Lightfast. Be among the first to experience the future of AI workflow automation for technical founders.",
  openGraph: {
    title: "Early Access - AI Workflow Automation Platform",
    description:
      "Join the waitlist for early access to Lightfast. Be among the first to experience the future of AI workflow automation.",
    url: "https://lightfast.ai/early-access",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Early Access - AI Workflow Automation Platform",
    description:
      "Join the waitlist for early access to Lightfast. Be among the first to experience the future of AI workflow automation.",
    images: ["https://lightfast.ai/og.jpg"],
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
    <div className="relative bg-card min-h-screen overflow-hidden">
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/orange-mouth.avif"
          alt="Background"
          fill
          className="object-cover"
          priority
          unoptimized
        />
      </div>

      {/* Frosted Glass Blur Overlay */}
      <div className="fixed inset-0 z-10 backdrop-blur-md bg-white/5" />

      {/* Logo - Top Left */}
      <div className="fixed px-4 py-2 z-30">
        <div className="-ml-2 flex items-center md:justify-self-start">
          <Button variant="none" size="lg" className="group" asChild>
            <Link href="/">
              <Icons.logo className="size-22 text-foreground transition-colors" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Form - Centered */}
      <div className="relative z-20 flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-md rounded-xs border border-border bg-background p-8 backdrop-blur-sm">
          <EarlyAccessFormProvider
            initialEmail={initialEmail}
            initialCompanySize={initialCompanySize}
            initialSources={initialSources}
          >
            <EarlyAccessForm />
          </EarlyAccessFormProvider>
        </div>
      </div>
    </div>
  );
}
