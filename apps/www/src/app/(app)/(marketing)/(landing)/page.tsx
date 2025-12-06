import type { Metadata } from "next";
import { exposureTrial } from "~/lib/fonts";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowRight } from "lucide-react";
import { VisualShowcase } from "~/components/visual-showcase";
import { SearchDemo } from "~/components/search-demo";
import { IntegrationShowcase } from "~/components/integration-showcase";
import { PlatformAccessCards } from "~/components/platform-access-cards";
import { ChangelogPreview } from "~/components/changelog-preview";
import { FAQSection, faqs } from "~/components/faq-section";
import { WaitlistCTA } from "~/components/waitlist-cta";
import { BecomingLightfast } from "~/components/becoming-lightfast";
import {
  JsonLd,
  type GraphContext,
  type Organization,
  type WebSite,
  type SoftwareApplication,
  type FAQPage,
  type Question,
  type Answer
} from "@vendor/seo/json-ld";

// SEO metadata for the landing page
export const metadata: Metadata = {
  title: "Lightfast – Memory Built for Teams | Search by Meaning",
  description: "Make your team's knowledge instantly searchable and trustworthy. Lightfast helps teams find answers with sources, understand context, and trace decisions.",
  keywords: [
    "team memory",
    "neural memory for teams",
    "semantic search",
    "knowledge management",
    "search by meaning",
    "answers with sources",
    "team knowledge base",
    "organizational memory",
    "decision tracking",
    "context management"
  ],
  authors: [
    { name: "Lightfast", url: "https://lightfast.ai" }
  ],
  creator: "Lightfast",
  publisher: "Lightfast",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://lightfast.ai",
  },
  openGraph: {
    title: "Lightfast – Memory Built for Teams",
    description: "Make your team's knowledge instantly searchable. Search by meaning, not keywords. Every answer shows its source.",
    url: "https://lightfast.ai",
    siteName: "Lightfast",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://lightfast.ai/og.jpg",
        width: 1200,
        height: 630,
        alt: "Lightfast – Memory Built for Teams",
        type: "image/jpeg",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast – Memory Built for Teams",
    description: "Make your team's knowledge instantly searchable. Search by meaning, not keywords. Every answer shows its source.",
    site: "@lightfastai",
    creator: "@lightfastai",
    images: ["https://lightfast.ai/og.jpg"],
  },
  category: "Technology",
};

export default function HomePage() {
  // Build organization entity
  const organizationEntity: Organization = {
    "@type": "Organization",
    "@id": "https://lightfast.ai/#organization",
    name: "Lightfast",
    url: "https://lightfast.ai",
    logo: {
      "@type": "ImageObject",
      url: "https://lightfast.ai/android-chrome-512x512.png",
    },
    sameAs: [
      "https://twitter.com/lightfastai",
      "https://github.com/lightfastai",
      "https://www.linkedin.com/company/lightfastai"
    ],
    description: "Lightfast is memory built for teams. We help people and agents find what they need, understand context, and trace decisions across their entire organization."
  };

  // Build website entity
  const websiteEntity: WebSite = {
    "@type": "WebSite",
    "@id": "https://lightfast.ai/#website",
    url: "https://lightfast.ai",
    name: "Lightfast",
    description: "Memory built for teams – Search by meaning, not keywords",
    publisher: {
      "@id": "https://lightfast.ai/#organization"
    }
  };

  // Build software application entity
  const softwareEntity: SoftwareApplication = {
    "@type": "SoftwareApplication",
    "@id": "https://lightfast.ai/#software",
    name: "Lightfast",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, API",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      url: "https://lightfast.ai/early-access"
    },
    description: "Neural memory for teams. Search and find answers with sources across your entire organization.",
    featureList: [
      "Search by meaning, not keywords",
      "Answers with sources",
      "Document & code memory",
      "Decision tracking",
      "Context preservation",
      "API access",
      "MCP tools for agents"
    ]
  };

  // Build FAQ entity
  const faqEntity: FAQPage = {
    "@type": "FAQPage",
    "@id": "https://lightfast.ai/#faq",
    mainEntity: faqs.map((faq) => {
      const question: Question = {
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        }
      };
      return question;
    })
  };

  // Combine all entities in a graph
  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [
      organizationEntity,
      websiteEntity,
      softwareEntity,
      faqEntity
    ]
  };

  return (
    <>
      {/* Structured data for SEO */}
      <JsonLd code={structuredData} />
      <div className="mt-6 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
        {/* Hero Section - centered content */}
        <div className="max-w-7xl mx-auto grid grid-cols-12">
          <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
            <section className="flex w-full flex-col items-center text-center">
              {/* Small label */}
              {/* <div className="mb-8 opacity-80">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Memory built for teams
                </p>
              </div>
              /*}

              {/* Heading */}
              <h1
                className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] px-4 text-balance ${exposureTrial.className}`}
              >
                Memory built for teams
                {/* Search everything your team knows.
                <br /> Get answers with sources. */}
              </h1>

              {/* Description */}
              <div className="mt-4 px-4 w-full">
                <p className="text-base text-muted-foreground whitespace-nowrap md:whitespace-normal lg:whitespace-nowrap">
                  Search everything your team knows. Get answers with sources.
                </p>
              </div>

              {/* CTA - centered */}
              <div className="mt-8 flex flex-col justify-center gap-8 sm:flex-row">
                <Button asChild size="lg" className="rounded-full">
                  <Link href="/early-access" className="group">
                    <span>Join Early Access</span>
                  </Link>
                </Button>
                <Link
                  href="/docs/get-started/overview"
                  className="group inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-foreground/80"
                >
                  <span>Learn more about Lightfast</span>
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </section>
          </div>
        </div>

        {/* Platform Access Cards */}
        <PlatformAccessCards />

        {/* Demo Section - Search Visual */}
        <div className="max-w-6xl px-4 mx-auto w-full py-10">
          <VisualShowcase>
            <SearchDemo />
          </VisualShowcase>
        </div>

        {/* Integration Showcase */}
        <div className="max-w-6xl mx-auto w-full px-4 py-10">
          <IntegrationShowcase />
        </div>

        {/* FAQ Section */}
        <div className="max-w-6xl mx-auto w-full px-4 py-10">
          <FAQSection />
        </div>

        {/* Background Image Section */}
        {/* <div className="max-w-6xl px-4 mx-auto w-full">
          <div className="relative rounded-xs w-full h-[720px] overflow-hidden">
            <div className="absolute inset-0 z-0">
              <Image
                src="/images/orange-mouth.webp"
                alt="Background"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="absolute inset-0 z-10 backdrop-blur-md bg-white/5" />
          </div>
        </div>
      */}

        {/* Changelog Preview */}
        <div className="max-w-6xl mx-auto w-full px-4">
          <ChangelogPreview />
        </div>

        {/* Becoming Lightfast Section - Seed Round Announcement 
        <div className="max-w-6xl mx-auto w-full px-4">
          <BecomingLightfast />
        </div>
        */}
      </div>

      {/* Waitlist CTA - Outside of padding container */}
      <WaitlistCTA />
    </>
  );
}
