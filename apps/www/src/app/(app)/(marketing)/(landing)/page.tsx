import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Search, RefreshCw, Users, Zap, Link2, Shield } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { faqs, FAQSection } from "~/components/faq-section";
import { IntegrationShowcase } from "~/components/integration-showcase";
import { ChangelogPreview } from "~/components/changelog-preview";
import { HeroChangelogBadge } from "~/components/hero-changelog-badge";
import { WaitlistCTA } from "~/components/waitlist-cta";
import { JsonLd } from "@vendor/seo/json-ld";
import type {GraphContext, Organization, WebSite, SoftwareApplication, FAQPage, Question} from "@vendor/seo/json-ld";

const benefits = [
  {
    icon: Search,
    title: "One search, all sources",
    description:
      "Search across all your connected tools at once. No more switching between apps to find what you need.",
  },
  {
    icon: RefreshCw,
    title: "Automatic sync",
    description:
      "Changes sync in real-time. New PRs, issues, and messages are indexed as they happen.",
  },
  {
    icon: Users,
    title: "Identity correlation",
    description:
      "Link the same person across platforms. john@company.com on GitHub is John Smith on Linear.",
  },
  {
    icon: Zap,
    title: "Instant answers",
    description:
      "Get answers from your connected tools without spending hours on research.",
  },
  {
    icon: Link2,
    title: "Track dependencies",
    description:
      "See what depends on what. Understand relationships across your codebase and documentation.",
  },
  {
    icon: Shield,
    title: "Privacy by default",
    description:
      "Your data stays yours. Complete tenant isolation with enterprise-grade security.",
  },
];

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
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast – The Memory Layer for Software Teams",
    description:
      "Make your team's knowledge instantly searchable. Search by meaning, not keywords. Every answer shows its source.",
    site: "@lightfastai",
    creator: "@lightfastai",
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

      {/* Preload the video poster on desktop — the <Image priority> below preloads
          the Next.js-optimised URL (/_next/image?...) which the browser cannot
          reuse for the raw poster attribute on the <video> element. This link
          targets the original URL so the browser has it in cache before the
          video element is painted, fixing desktop LCP.
          React 19 / Next.js 15 hoist <link> elements from Server Components to <head>. */}
      <link
        rel="preload"
        as="image"
        href="/images/landing-hero-poster.webp"
        fetchPriority="high"
        media="(min-width: 768px)"
      />

      {/* Grid-based landing page */}
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative min-h-screen w-full bg-background overflow-hidden">
          {/* Mobile hero: static image only — no video download on mobile */}
          <div className="md:hidden pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="absolute w-[150%] h-[90%] top-[22%] -right-[42%]">
              <Image
                src="/images/landing-hero-poster.webp"
                alt="Data flows through the Lightfast engine"
                fill
                priority
                // Scope to mobile only — on desktop (hidden) this would preload
                // a 2160px+ image for a display:none element. The desktop poster
                // is covered by the <link rel="preload"> above.
                sizes="(max-width: 767px) 150vw, 1px"
                className="object-contain object-[65%_25%]"
              />
            </div>
          </div>

          {/* Desktop hero: animated WebM video */}
          <div className="hidden md:block pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute
                w-[100%] h-[85%] top-[25%] -right-[10%]
                lg:w-[80%] lg:h-[95%] lg:top-[5%] lg:-right-[12.5%]"
            >
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="none"
                poster="/images/landing-hero-poster.webp"
                className="w-full h-full object-contain object-right-top"
              >
                <source src="/images/landing-hero.webm" type="video/webm" />
              </video>
            </div>
          </div>

          {/* Hero text - positioned on the left */}
          <div className="relative z-20 mx-auto flex w-full max-w-[1400px] items-start pt-[18vh] md:pt-[15vh] lg:items-center lg:pt-0 min-h-screen px-8 pb-24 md:px-16 md:pb-32 lg:px-24 lg:pb-40">
            <div className="flex max-w-sm md:max-w-lg lg:max-w-sm flex-col justify-center w-full">
              <Icons.logoShort className="hidden md:block w-5 h-5 mb-4 text-muted-foreground" />
              <h1 className="text-4xl md:text-3xl lg:text-3xl font-pp font-medium mb-4">
                <span className="text-muted-foreground">The</span>{" "}
                <span className="text-primary">memory layer</span>{" "}
                <span className="text-muted-foreground">
                  for software teams and AI agents.
                </span>
              </h1>
              <div>
                <Button asChild size="sm">
                  <Link href="/early-access">
                    Join Early Access
                    <span className="ml-2">→</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Changelog badge - pinned to bottom of initial viewport */}
          <div className="absolute inset-x-0 top-0 z-30 h-screen pointer-events-none flex items-end pb-8">
            <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
              <div className="pointer-events-auto">
                <HeroChangelogBadge />
              </div>
            </div>
          </div>
        </section>

        {/* Integrations Section */}
        <section className="w-full py-16">
          <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
            <IntegrationShowcase />
          </div>
        </section>

        {/* Connect Your Tools Section */}
        <section className="w-full bg-background py-24 md:py-32">
          <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16">
              {/* Left: Badge */}
              <div>
                <span className="inline-flex items-center h-7 px-3 rounded-md border border-border text-xs text-muted-foreground">
                  Connect Your Tools
                </span>
              </div>

              {/* Right: Content + Cards - spans 2 columns */}
              <div className="lg:col-span-2">
                <p className="text-base md:text-md leading-relaxed text-foreground/80 max-w-xl mb-12">
                  Pull in knowledge from where your team already works.
                  GitHub, Linear, Notion, Slack, and more—all searchable in
                  one place.
                </p>

                {/* Benefits Grid - negative margin to align icon/title with text above */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {benefits.map((benefit) => {
                    const Icon = benefit.icon;
                    return (
                      <div
                        key={benefit.title}
                        className="border border-border rounded-md p-8"
                      >
                        <div className="mb-12">
                          <Icon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <h3 className="mb-2 text-base font-medium">
                          {benefit.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {benefit.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="w-full bg-background py-24 md:py-32">
          <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
            <FAQSection />
          </div>
        </section>

        {/* Changelog Preview */}
        <section className="w-full bg-background py-24 md:py-32">
          <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
            <ChangelogPreview />
          </div>
        </section>
      </div>

      {/* CTA Section */}
      <WaitlistCTA />
    </>
  );
}
