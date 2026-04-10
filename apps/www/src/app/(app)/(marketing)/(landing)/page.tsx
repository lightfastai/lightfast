import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import type {
  FAQPage,
  GraphContext,
  Organization,
  Question,
  SoftwareApplication,
  WebSite,
} from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Activity, Blocks, Brain, Plug, Shield, Wand2 } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { ChangelogPreview } from "~/app/(app)/_components/changelog-preview";
import { FAQSection, faqs } from "~/app/(app)/_components/faq-section";
import { HeroChangelogBadge } from "~/app/(app)/_components/hero-changelog-badge";
import { IntegrationShowcase } from "~/app/(app)/_components/integration-showcase";
import { ProductDemo } from "~/app/(app)/_components/product-demo";
import { WaitlistCTA } from "~/app/(app)/_components/waitlist-cta";

const benefits = [
  {
    icon: Activity,
    title: "Observe everything",
    description:
      "Events from every connected tool — code changes, deployments, incidents, messages — ingested automatically in real time.",
  },
  {
    icon: Brain,
    title: "Memory with sources",
    description:
      "Search by meaning across everything that happened. Every answer traces back to the source event — no black-box responses.",
  },
  {
    icon: Wand2,
    title: "Intent, not API calls",
    description:
      "Agents express what they want. Lightfast resolves where and how — across any connected tool.",
  },
  {
    icon: Blocks,
    title: "Same primitives for all",
    description:
      "REST API, TypeScript SDK, MCP tools, and webhooks. Agents and people operate through the same system.",
  },
  {
    icon: Plug,
    title: "Connect in minutes",
    description:
      "GitHub, Vercel, Sentry, Linear today. Slack, Notion, PagerDuty coming soon. One integration, every event.",
  },
  {
    icon: Shield,
    title: "Privacy by default",
    description:
      "Complete tenant isolation. Your data stays yours. We never train on your data.",
  },
];

// SEO metadata for the landing page
export const metadata: Metadata = {
  title: "Superintelligence Layer for Founders",
  description:
    "Lightfast is the superintelligence layer for founders. Built on a unified operating layer that connects your tools, unifies your agents, and orchestrates your entire operation.",
  keywords: [
    "superintelligence",
    "AI for founders",
    "founder tools",
    "operating infrastructure",
    "agent infrastructure",
    "event-driven architecture",
    "tool integration",
    "MCP tools",
    "AI agent platform",
    "real-time events",
    "operating layer",
    "agents and apps",
    "observe remember act",
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
    title: "Lightfast – Superintelligence Layer for Founders",
    description:
      "The superintelligence layer for founders. Built on a unified operating layer — your tools, your agents, your entire operation orchestrated in one place.",
    url: "https://lightfast.ai",
    siteName: "Lightfast",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast – Superintelligence Layer for Founders",
    description:
      "The superintelligence layer for founders. Built on a unified operating layer — your tools, your agents, your entire operation orchestrated in one place.",
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
      "Lightfast is the superintelligence layer for founders. Built on a unified operating layer that connects tools, unifies agents, and orchestrates entire operations through one system.",
  };

  // Build website entity
  const websiteEntity: WebSite = {
    "@type": "WebSite",
    "@id": "https://lightfast.ai/#website",
    url: "https://lightfast.ai",
    name: "Lightfast",
    description:
      "Superintelligence layer for founders — built on a unified operating layer to observe, remember, and act across every tool.",
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
      "The superintelligence layer for founders. Built on a unified operating layer — observe events, build memory, and orchestrate action across your entire tool stack through a single system.",
    featureList: [
      "Real-time event ingestion from connected tools",
      "Semantic search with cited sources",
      "MCP tools for AI agents",
      "REST API and TypeScript SDK",
      "Intent-based action resolution",
      "Complete tenant isolation",
      "Webhook event delivery",
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
        as="image"
        fetchPriority="high"
        href="/images/landing-hero-poster.webp"
        media="(min-width: 768px)"
        rel="preload"
      />

      {/* Grid-based landing page */}
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative min-h-screen w-full overflow-hidden bg-background">
          {/* Mobile hero: static image only — no video download on mobile */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden md:hidden">
            <div className="absolute top-[18%] -right-[50%] h-[110%] w-[180%]">
              <Image
                alt="Data flows through the Lightfast engine"
                className="object-contain object-[65%_25%]"
                fetchPriority="high"
                fill
                priority
                sizes="(max-width: 767px) 150vw, 1px"
                src="/images/landing-hero-poster.webp"
              />
            </div>
          </div>

          {/* Desktop hero: animated WebM video */}
          <div className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden md:block">
            <div className="absolute top-[20%] -right-[20%] h-[100%] w-[120%] lg:top-[0%] lg:-right-[20%] lg:h-[110%] lg:w-[95%]">
              <video
                autoPlay
                className="h-full w-full object-contain object-right-top"
                loop
                muted
                playsInline
                poster="/images/landing-hero-poster.webp"
                preload="none"
              >
                <source
                  media="(min-width: 768px)"
                  src="/images/landing-hero.webm"
                  type="video/webm"
                />
              </video>
            </div>
          </div>

          {/* Vignette overlay */}
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background: [
                "linear-gradient(to top, var(--background) 0%, transparent 25%)",
                "linear-gradient(to left, var(--background) 0%, transparent 20%)",
                "linear-gradient(to top right, var(--background) 0% 15%, transparent 50%)",
                "linear-gradient(to bottom right, var(--background) 0% 8%, transparent 40%)",
              ].join(", "),
            }}
          />

          {/* Hero text - positioned on the left */}
          <div className="relative z-20 mx-auto flex min-h-screen w-full max-w-[1400px] items-start px-8 pt-[18vh] pb-24 md:px-16 md:pt-[15vh] md:pb-32 lg:items-center lg:px-24 lg:pt-0 lg:pb-40">
            <div className="flex w-full max-w-sm flex-col justify-center md:max-w-lg lg:max-w-sm">
              <Icons.logoShort className="mb-4 hidden h-5 w-5 text-muted-foreground md:block" />
              <h1 className="mb-4 font-medium font-pp text-4xl md:text-3xl lg:text-3xl">
                <span className="text-muted-foreground">Building the</span>{" "}
                <span className="text-primary">superintelligence layer</span>{" "}
                <span className="text-muted-foreground">for</span>{" "}
                <span className="text-primary">founders.</span>
              </h1>
              <div>
                <Button asChild size="sm">
                  <MicrofrontendLink href="/early-access" prefetch={true}>
                    Join Early Access
                    <span className="ml-2">&rarr;</span>
                  </MicrofrontendLink>
                </Button>
              </div>
            </div>
          </div>

          {/* Changelog badge - pinned to bottom of initial viewport */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-screen items-end pb-8">
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
        {/* Product Demo Section — bottom 33% clipped */}
        <section className="w-full overflow-hidden border-b border-t border-border/50 bg-accent/50 pt-24 md:pt-32">
          <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
            <div className="mb-12 max-w-lg md:mb-8">
              <h2 className="mb-4 font-medium font-pp text-2xl md:text-3xl">
                One place for everything that happens
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Events from GitHub, Sentry, Linear, and Vercel stream into a
                single feed. Search across your entire stack by meaning — every
                answer traces back to the source.
              </p>
            </div>
            <div className="h-[360px] overflow-hidden md:h-[388px] lg:h-[475px]">
              <ProductDemo />
            </div>
          </div>
        </section>

        {/* Connect Your Tools Section */}
        <section className="w-full bg-background py-24 md:py-32">
          <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-16">
              {/* Left: Badge */}
              <div>
                <span className="inline-flex h-7 items-center rounded-md border border-border px-3 text-muted-foreground text-sm">
                  Connect Your Tools
                </span>
              </div>

              {/* Right: Content + Cards - spans 2 columns */}
              <div className="lg:col-span-2">
                <p className="mb-12 max-w-xl text-base text-foreground/80 leading-relaxed md:text-md">
                  Observe events from where your team already works. GitHub,
                  Vercel, Sentry, Linear, and more — all flowing through one
                  system.
                </p>

                {/* Benefits Grid - negative margin to align icon/title with text above */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {benefits.map((benefit) => {
                    const Icon = benefit.icon;
                    return (
                      <div
                        className="rounded-md border border-border/50 p-8"
                        key={benefit.title}
                      >
                        <div className="mb-12">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <h3 className="mb-2 font-medium text-base">
                          {benefit.title}
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
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
