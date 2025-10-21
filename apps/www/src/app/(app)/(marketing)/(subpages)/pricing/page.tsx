import type { Metadata } from "next";
import { PricingHero } from "~/components/pricing/pricing-hero";
import { PricingSimple } from "~/components/pricing/pricing-simple";
import { PricingFAQ } from "~/components/pricing/pricing-faq";
import { StructuredData } from "~/components/structured-data";

export const metadata: Metadata = {
  title: "Pricing - AI Workflow Automation Platform",
  description:
    "Pricing starts free with 5 integrations and 100 workflow runs per month. Scale with Pro ($29/mo) or Team ($99/mo). Open-source and self-hostable.",
  keywords: [
    "AI workflow automation pricing",
    "workflow automation cost",
    "workflow orchestration pricing",
    "AI integration platform",
    "open source automation",
    "self-hosted workflows",
    "dev automation tools",
    "AI workflow plans",
    "integration automation cost",
    "workflow automation pricing",
    "AI orchestration pricing",
  ],
  openGraph: {
    title: "Pricing - AI Workflow Automation Platform",
    description:
      "Simple, transparent pricing for AI workflow automation. Start free with 5 integrations. Scale with Pro or Team plans.",
    url: "https://lightfast.ai/pricing",
    type: "website",
    images: [
      {
        url: "https://lightfast.ai/og.jpg",
        width: 1200,
        height: 630,
        alt: "AI Workflow Automation Platform",
      },
    ],
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
};

export default function PricingPage() {
  return (
    <>
      <StructuredData
        type="SoftwareApplication"
        additionalData={{
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
        }}
      />
      <div className="min-h-screen flex flex-col gap-4 py-16">
        {/* Hero Section */}
        <section className="relative">
          <div className="relative max-w-5xl mx-auto">
            <div className="py-8 px-4 sm:px-6 lg:px-8">
              <PricingHero />
            </div>
          </div>
        </section>

        {/* Simple Pricing Section */}
        <section className="relative">
          <div className="relative max-w-7xl mx-auto">
            <div className="py-8 px-4 sm:px-6 lg:px-8">
              <PricingSimple />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="relative">
          <div className="relative max-w-7xl mx-auto">
            <div className="py-8 px-4 sm:px-6 lg:px-8">
              <PricingFAQ />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
