import type { Metadata } from "next";
import Image from "next/image";
import { createMetadata } from "@vendor/seo/metadata";
import { Icons } from "@repo/ui/components/icons";
import { EarlyAccessForm } from "~/components/early-access-form";
import { EarlyAccessFormProvider } from "~/components/early-access-form-provider";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = createMetadata({
  title: "Early Access – Lightfast Neural Memory for Teams",
  description:
    "Join the waitlist for early access to Lightfast neural memory. Be among the first to search everything your organization knows by meaning and get answers with sources.",
  openGraph: {
    title: "Early Access – Lightfast Neural Memory for Teams",
    description:
      "Sign up for early access to Lightfast, team memory that lets people and agents search everything your organization knows by meaning and get answers with sources.",
    url: "https://lightfast.ai/early-access",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Early Access – Lightfast Neural Memory for Teams",
    description:
      "Join the early access list for Lightfast neural memory built for teams.",
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
          src="https://imagedelivery.net/UEsH3Cp6PfMQ5nCsxDnDxQ/62c40fbf-28d6-4ef3-8db6-89af016e7200/public"
          alt="Background"
          fill
          priority
          sizes="100vw"
          quality={10}
          draggable={false}
          className="object-cover"
        />
      </div>

      {/* Frosted Glass Blur Overlay */}
      <div className="fixed inset-0 z-10 backdrop-blur-md bg-white/5" />

      {/* Logo - Top Left */}
      <div className="fixed px-4 py-2 z-30">
        <div className="-ml-2 flex items-center md:justify-self-start">
          <Button variant="none" size="lg" className="group" asChild>
            <Link href="/" prefetch>
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
