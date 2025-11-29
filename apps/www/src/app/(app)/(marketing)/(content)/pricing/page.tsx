import type { Metadata } from "next";
import { createMetadata } from "@vendor/seo/metadata";
import { PricingSimple } from "~/components/pricing/pricing-simple";
import { PricingFAQ } from "~/components/pricing/pricing-faq";
import { JsonLd, type SoftwareApplication, type WithContext } from "@vendor/seo/json-ld";
import { siteConfig } from "@repo/site-config";
import { exposureTrial } from "~/lib/fonts";

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
      <div className="mt-10 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
        {/* Hero Section */}
        <section className="relative">
          <div className="max-w-7xl mx-auto grid grid-cols-12">
            <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
              <div className="flex w-full flex-col items-center text-center">
                {/* Small label */}
                <div className="mb-8 opacity-80">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Simple & Transparent
                  </p>
                </div>

                {/* Heading */}
                <h1
                  className={`text-3xl sm:text-4xl md:text-5xl font-light leading-[1.1] tracking-[-0.02em] px-4 text-balance ${exposureTrial.className}`}
                >
                  Pricing
                </h1>

                {/* Description */}
                <div className="mt-8 px-4">
                  <p className="text-base text-muted-foreground">
                    Simple, transparent pricing for AI workflow automation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Simple Pricing Section */}
        <div className="max-w-7xl px-4 mx-auto w-full py-10">
          <PricingSimple />
        </div>

        {/* FAQ Section */}
        <div className="max-w-7xl mx-auto w-full px-4 py-10">
          <PricingFAQ />
        </div>
      </div>
    </>
  );
}
