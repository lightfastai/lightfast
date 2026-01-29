import type { Metadata } from "next";
import { exposureTrial } from "~/lib/fonts";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@repo/ui/components/ui/button";
import { AnnouncementBadge } from "~/components/announcement-badge";
import { VisualShowcase } from "~/components/visual-showcase";
import { SearchDemo } from "~/components/search-demo";
import { IntegrationShowcase } from "~/components/integration-showcase";
import { PlatformAccessCards } from "~/components/platform-access-cards";
import { ChangelogPreview } from "~/components/changelog-preview";
import { FAQSection, faqs } from "~/components/faq-section";
import { WaitlistCTA } from "~/components/waitlist-cta";
import { BecomingLightfast } from "~/components/becoming-lightfast";
import { DitheredBackground } from "~/components/dithered-background";
import {
  JsonLd,
  type GraphContext,
  type Organization,
  type WebSite,
  type SoftwareApplication,
  type FAQPage,
  type Question,
  type Answer,
} from "@vendor/seo/json-ld";

// SEO metadata for the landing page
export const metadata: Metadata = {
  title: "The Memory Layer for Software Teams",
  description:
    "Search everything your engineering org knows—code, PRs, docs, decisions—with answers that cite their sources",
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
    "context management",
  ],
  authors: [{ name: "Lightfast", url: "https://lightfast.ai" }],
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
    title: "Lightfast – The Memory Layer for Software Teams",
    description:
      "Make your team's knowledge instantly searchable. Search by meaning, not keywords. Every answer shows its source.",
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
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast – The Memory Layer for Software Teams",
    description:
      "Make your team's knowledge instantly searchable. Search by meaning, not keywords. Every answer shows its source.",
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
      "https://www.linkedin.com/company/lightfastai",
    ],
    description:
      "Lightfast is memory built for teams. We help people and agents find what they need, understand context, and trace decisions across their entire organization.",
  };

  // Build website entity
  const websiteEntity: WebSite = {
    "@type": "WebSite",
    "@id": "https://lightfast.ai/#website",
    url: "https://lightfast.ai",
    name: "Lightfast",
    description: "Memory built for teams – Search by meaning, not keywords",
    publisher: {
      "@id": "https://lightfast.ai/#organization",
    },
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
      url: "https://lightfast.ai/early-access",
    },
    description:
      "Neural memory for teams. Search and find answers with sources across your entire organization.",
    featureList: [
      "Search by meaning, not keywords",
      "Answers with sources",
      "Document & code memory",
      "Decision tracking",
      "Context preservation",
      "API access",
      "MCP tools for agents",
    ],
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
        },
      };
      return question;
    }),
  };

  // Combine all entities in a graph
  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [organizationEntity, websiteEntity, softwareEntity, faqEntity],
  };

  return (
    <>
      {/* Structured data for SEO */}
      <JsonLd code={structuredData} />
      <div className="mt-16 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
        {/* Hero Section - centered content */}
        <div className="max-w-7xl mx-auto grid grid-cols-12">
          <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
            <section className="flex w-full flex-col items-center text-center">
              {/* Announcement badge */}
              <AnnouncementBadge />

              {/* Heading */}
              <h1
                className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-light px-4 text-balance ${exposureTrial.className}`}
              >
                The memory layer for software teams
              </h1>

              {/* Description */}
              <div className="mt-6 px-4 w-full">
                <p className="text-lg md:text-xl text-muted-foreground">
                  Search everything your engineering org knows
                </p>
              </div>

              {/* Email CTA */}
              <div className="mt-10 w-full max-w-xl px-4">
                <form className="relative flex h-12 items-center rounded-full bg-secondary/50 border border-border/30 pl-6 pr-2">
                  <input
                    type="email"
                    placeholder="Enter your company email"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <Button type="submit" className="rounded-full px-6 shrink-0">
                    Join Waitlist
                  </Button>
                </form>
              </div>
            </section>
          </div>
        </div>

        {/* Platform Access Cards */}
        <div className="py-16 md:py-24">
          <div className="relative">
            {/* Dithered background - starts at ~20% of card height */}
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-screen h-[calc(100%+6rem)] overflow-hidden">
              <DitheredBackground />
            </div>

            {/* Cards - positioned above the blue background */}
            <div className="relative z-10 max-w-6xl px-4 mx-auto">
              <PlatformAccessCards />
            </div>
          </div>
        </div>

        {/* Demo Section - Search Visual */}
        <div className="max-w-6xl px-4 mx-auto w-full py-64">
          <VisualShowcase>
            <SearchDemo />
          </VisualShowcase>
        </div>

        {/* Integration Showcase */}
        <div className="max-w-6xl mx-auto w-full px-4 py-10 space-y-8">
          <div className="text-center">
            <h2 className="text-sm">
              <span className="text-muted-foreground">
                Lightfast integrates with the tools you use
              </span>
            </h2>
          </div>
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
