import type { Metadata } from "next";
import { createMetadata } from "@vendor/seo/metadata";
import { PricingHero } from "~/components/pricing/pricing-hero";
import { PricingSimple } from "~/components/pricing/pricing-simple";
import { PricingFAQ } from "~/components/pricing/pricing-faq";
import { JsonLd, type SoftwareApplication, type WithContext } from "@vendor/seo/json-ld";
import { siteConfig } from "@repo/site-config";

export const metadata: Metadata = createMetadata({
  title: "Pricing - AI Workflow Automation Platform",
  description:
    "Pricing starts free with 5 integrations and 100 workflow runs per month. Scale with Pro ($29/mo) or Team ($99/mo). Open-source and self-hostable.",
  openGraph: {
    title: "Pricing - AI Workflow Automation Platform",
    description:
      "Simple, transparent pricing for AI workflow automation. Start free with 5 integrations. Scale with Pro or Team plans.",
    url: "https://lightfast.ai/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing - AI Workflow Automation Platform",
    description:
      "Simple, transparent pricing for AI workflow automation. Start free with 5 integrations. Scale with Pro or Team plans.",
    images: ["https://lightfast.ai/og.jpg"],
  },
  alternates: {
    canonical: "https://lightfast.ai/pricing",
  },
});

export default function PricingPage() {
  const softwareSchema: WithContext<SoftwareApplication> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    url: siteConfig.url,
    applicationCategory: "DeveloperApplication",
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: "Get started with AI workflow automation",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "29",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: "Scale your workflows with unlimited integrations",
      },
      {
        "@type": "Offer",
        name: "Team",
        price: "99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: "Collaborate and build together",
      },
    ],
    isAccessibleForFree: true,
    license: "https://github.com/lightfastai/lightfast/blob/main/LICENSE",
  };

  return (
    <>
      <JsonLd code={softwareSchema} />
      <div className="min-h-screen flex flex-col gap-36">
        {/* Hero Section */}
        <section className="relative">
          <div className="relative">
            <PricingHero />
          </div>
        </section>

        {/* Simple Pricing Section */}
        <section className="relative">
          <div className="relative">
            <PricingSimple />
          </div>
        </section>

        {/* FAQ Section */}
        <section className="relative">
          <div className="relative">
            <PricingFAQ />
          </div>
        </section>
      </div>
    </>
  );
}
