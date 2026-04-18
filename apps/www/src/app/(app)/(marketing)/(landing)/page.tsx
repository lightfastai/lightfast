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
import type { Metadata } from "next";
import { LatestContentPreview } from "~/app/(app)/_components/latest-content-preview";
import { FAQSection, faqs } from "~/app/(app)/_components/faq-section";
import { HeroChangelogBadge } from "~/app/(app)/_components/hero-changelog-badge";
import { WaitlistCTA } from "~/app/(app)/_components/waitlist-cta";
import {
  HAIRLINE_BOTTOM_X_PCT,
  HAIRLINE_X_PCT,
  HAIRLINE_Y_PCT,
  IsometricHero,
} from "./_components/isometric-hero";
import { FlowField } from "./_components/flow-field";

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

export const revalidate = 3600;

async function getLatestCommit(): Promise<{ hash: string; url: string }> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/lightfastai/.lightfast/commits?per_page=1",
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}`);
    }
    const [commit] = (await res.json()) as [{ sha: string }];
    return {
      hash: commit.sha.slice(0, 7),
      url: `https://github.com/lightfastai/.lightfast/commit/${commit.sha}`,
    };
  } catch {
    return {
      hash: "unknown",
      url: "https://github.com/lightfastai/.lightfast",
    };
  }
}

export default async function HomePage() {
  const { hash, url } = await getLatestCommit();
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

      {/* Grid-based landing page */}
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative min-h-screen w-full overflow-clip bg-background">
          {/* Right: Isometric Lissajous SVG — golden ratio from top, right-aligned */}
          <div className="pointer-events-none absolute inset-0 z-0 hidden items-center justify-end pb-[18vh] lg:flex">
            <div className="relative mr-24 w-[55%] max-w-[750px]">
              {/* Horizontal extension line — from right card edge to viewport edge */}
              <div
                className="absolute left-full h-px w-[100vw]"
                style={{
                  top: `${HAIRLINE_Y_PCT}%`,
                  backgroundColor: "var(--border)",
                }}
              />
              {/* Vertical extension lines — from card edges to section edges */}
              <div
                className="absolute bottom-full w-px h-[100vh]"
                style={{
                  left: `${HAIRLINE_X_PCT}%`,
                  backgroundColor: "var(--border)",
                }}
              />
              <div
                className="absolute top-full w-px h-[100vh]"
                style={{
                  left: `${HAIRLINE_BOTTOM_X_PCT}%`,
                  backgroundColor: "var(--border)",
                }}
              />
              <IsometricHero />
            </div>
          </div>

          {/* Left: Text + CTA — above the horizontal hairline */}
          <div className="relative z-20 mx-auto flex min-h-screen w-full max-w-[1400px] items-start px-8 pt-[18vh] pb-24 md:px-16 md:pt-[15vh] md:pb-32 lg:items-end lg:px-24 lg:pt-0 lg:pb-[56vh]">
            <div className="flex w-full max-w-sm flex-col justify-center md:max-w-lg lg:max-w-sm">
              <h1 className="mb-4 font-medium font-pp text-4xl md:text-3xl lg:text-3xl">
                <span className="text-muted-foreground">Building the</span>{" "}
                <span className="text-primary">superintelligence layer</span>{" "}
                <span className="text-muted-foreground">for</span>{" "}
                <span className="text-primary">teams and agents.</span>
              </h1>
              <div>
                <Button asChild size="sm">
                  <MicrofrontendLink href="/early-access" prefetch={true}>
                    Join Early Access
                    <span className="ml-2">→</span>
                  </MicrofrontendLink>
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile: Isometric SVG below text */}
          <div className="px-8 pb-24 md:px-16 lg:hidden">
            <IsometricHero />
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

        {/* Full-width horizontal hairline at bottom of hero */}
        <div
          className="hidden w-full lg:block"
          style={{ height: 1, backgroundColor: "var(--border)" }}
        />

        {/* Company / Manifesto Section */}
        {/* <section className="dark relative w-full bg-background text-foreground">
          <div className="relative flex h-screen flex-col">
            <div className="relative flex-[5]">
              <header className="relative flex items-start justify-between px-6 pt-6">
                <div className="absolute left-[50%] max-w-sm space-y-4 font-pp text-lg lg:text-2xl">
                  <p className="font-medium text-foreground">
                    This is our specification.
                  </p>
                  <p className="font-medium text-foreground">
                    We are building the runtime that executes Programs — the
                    substrate where organisational intelligence runs
                    autonomously, accumulates memory, and compounds over time.
                  </p>
                  <p className="font-medium text-foreground">
                    We believe a company should be expressible as a Program. We
                    believe a founder's highest leverage is writing that Program
                    clearly. We believe everything else — the orchestration, the
                    memory, the execution, the intelligence — is the runtime's
                    job.
                  </p>
                </div>
              </header>

              <div className="absolute right-0 bottom-6 left-0 flex items-start">
                <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-8 md:px-16 lg:px-24">
                  <span className="font-mono text-sm text-foreground uppercase">
                    Read the Program →
                  </span>
                  <a
                    className="font-mono text-sm text-foreground uppercase hover:underline"
                    href={url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    @{hash}
                  </a>
                </div>
                <p className="absolute left-[50%] font-pp text-lg font-semibold text-foreground lg:text-2xl">
                  We are building the runtime.
                </p>
              </div>
            </div>

            <div className="relative h-[30vh] border-t border-b border-border">
              <FlowField />
            </div>
          </div>
        </section> */}

        {/* Self-Driving Product Development Section */}
        {/* <section className="w-full bg-background py-24 md:py-32">
          <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
            <div className="mb-12 max-w-4xl md:mb-16">
              <h2 className="font-medium font-pp text-2xl md:text-3xl lg:text-4xl">
                <span className="text-primary">
                  Operationalize product development with ambient intelligence.
                </span>{" "}
                <span className="text-muted-foreground">
                  Built for AI-native software development teams, Lightfast
                  enables an entirely new layer of self-driving product
                  development.
                </span>
              </h2>
            </div>
            <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
              <div className="aspect-video rounded-md border border-border/50 bg-card/40" />
              <div className="aspect-video rounded-md border border-border/50 bg-card/40" />
              <div className="aspect-video rounded-md border border-border/50 bg-card/40" />
              <div className="aspect-video rounded-md border border-border/50 bg-card/40" />
            </div>
          </div>
        </section> */}

        {/* Full Understanding Section */}
        {/* <section className="relative w-full overflow-hidden bg-background py-24 md:py-32">
          <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
            <div className="mb-16 text-center md:mb-24">
              <h2 className="mx-auto max-w-3xl font-medium font-pp text-3xl md:text-4xl lg:text-5xl">
                A full understanding of your company and tools
              </h2>
            </div>

            <div className="relative">
              <div className="w-full max-w-sm space-y-12">
                <div>
                  <h3 className="mb-3 font-medium font-pp text-xl md:text-2xl">
                    Every customer interaction in context
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Lightfast reads emails, meeting transcripts, and other
                    conversation records you share with it to compile an
                    exhaustive history of your customer relationships.
                  </p>
                </div>
                <div>
                  <h3 className="mb-3 font-medium font-pp text-xl md:text-2xl">
                    A world model for your business
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Lightfast develops contextual understanding of your
                    company, your product, and your market. This gives agents
                    comprehensive context when they answer questions or perform
                    tasks for you.
                  </p>
                </div>
                <div>
                  <h3 className="mb-3 font-medium font-pp text-xl md:text-2xl">
                    Schema-less foundation
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    No upfront configuration required — Lightfast captures
                    everything from day 1 and lets you evolve your data model
                    over time.
                  </p>
                </div>
              </div>

              <video
                autoPlay
                className="mt-12 w-full lg:absolute lg:top-1/2 lg:left-[420px] lg:mt-0 lg:w-[70vw] lg:max-w-none lg:-translate-y-1/2"
                loop
                muted
                playsInline
                poster="/images/landing-hero-poster.webp"
              >
                <source src="/images/landing-hero.webm" type="video/webm" />
              </video>
            </div>
          </div>
        </section> */}

        {/* FAQ Section */}
        <section className="w-full bg-background py-24 md:py-32">
          <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
            <FAQSection />
          </div>
        </section>

        {/* Featured Content Preview */}
        <section className="w-full bg-background pb-24 md:pb-32">
          <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
            <LatestContentPreview />
          </div>
        </section>
      </div>

      {/* CTA Section */}
      <WaitlistCTA />
    </>
  );
}
