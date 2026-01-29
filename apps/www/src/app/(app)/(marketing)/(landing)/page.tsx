import type { Metadata } from "next";
import { exposureTrial } from "~/lib/fonts";
import { faqs } from "~/components/faq-section";
import {
  JsonLd,
  type GraphContext,
  type Organization,
  type WebSite,
  type SoftwareApplication,
  type FAQPage,
  type Question,
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

      {/* Grid-based landing page */}
      <div className="min-h-screen bg-[#f5f5f5]">
        {/* Hero Section with Grid */}
        <section className="relative w-full min-h-screen">
          {/* Double-lined grid background */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Vertical lines - 6 columns */}
            <div className="absolute inset-0 flex">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={`v-${i}`}
                  className="flex-1 border-l border-[#e0e0e0] first:border-l-0 last:border-r"
                  style={{
                    borderLeftWidth: i === 0 ? 0 : "1px",
                    boxShadow:
                      i > 0 ? "inset 2px 0 0 0 #e0e0e0" : "none",
                  }}
                >
                  {/* Inner double line */}
                  <div className="h-full w-[2px] ml-[-1px] bg-transparent border-r border-[#e8e8e8]" />
                </div>
              ))}
            </div>
            {/* Horizontal lines - 8 rows */}
            <div className="absolute inset-0 flex flex-col">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={`h-${i}`}
                  className="flex-1 border-t border-[#e0e0e0] first:border-t-0 last:border-b"
                  style={{
                    borderTopWidth: i === 0 ? 0 : "1px",
                    boxShadow:
                      i > 0 ? "inset 0 2px 0 0 #e0e0e0" : "none",
                  }}
                >
                  {/* Inner double line */}
                  <div className="w-full h-[2px] mt-[-1px] bg-transparent border-b border-[#e8e8e8]" />
                </div>
              ))}
            </div>
          </div>

          {/* Grid content container */}
          <div className="relative z-10 grid grid-cols-6 grid-rows-8 w-full min-h-screen p-8">
            {/* Top left - Tagline */}
            <div className="col-span-2 row-span-1 p-4">
              <p className="text-xs text-muted-foreground leading-tight">
                Memory Built
                <br />
                For Teams.
              </p>
            </div>

            {/* Top right - Intro text */}
            <div className="col-start-5 col-span-2 row-span-1 p-4 text-right">
              <p className="text-xs text-muted-foreground leading-tight">
                Introducing the
                <br />
                Memory Layer for Software Teams
              </p>
            </div>

            {/* Main headline - spans multiple columns and rows */}
            <div className="col-span-4 row-start-2 row-span-2 p-4 flex items-end">
              <h1
                className={`text-4xl md:text-5xl lg:text-6xl font-light leading-[1.1] ${exposureTrial.className}`}
              >
                <span className="text-foreground">The Memory Layer</span>
                <br />
                <span className="text-foreground">for Software</span>{" "}
                <span className="text-muted-foreground">Teams</span>
                <br />
                <span className="text-muted-foreground">
                  and AI Agents
                </span>
              </h1>
            </div>

            {/* Right side - Blue visual block */}
            <div className="col-start-5 col-span-2 row-start-2 row-span-4 bg-[#2563eb] flex items-center justify-center">
              {/* Placeholder for visual element */}
              <div className="w-24 h-24 opacity-20">
                <svg
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="2" />
                  <path
                    d="M50 10 L50 90 M10 50 L90 50 M25 25 L75 75 M75 25 L25 75"
                    stroke="white"
                    strokeWidth="1"
                  />
                </svg>
              </div>
            </div>

            {/* Side text on blue block */}
            <div className="col-start-6 col-span-1 row-start-2 row-span-1 p-4 flex items-start justify-end">
              <p className="text-xs text-white text-right leading-tight">
                Search everything your
                <br />
                engineering org knows.
              </p>
            </div>

            {/* Feature section - left side */}
            <div className="col-span-2 row-start-5 row-span-2 p-4">
              <h2 className="text-sm font-medium mb-4">Semantic Search</h2>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Search by meaning, not keywords.
                <br />
                Find answers across code, docs,
                <br />
                PRs, and decisions.
              </p>
              <a href="/early-access" className="text-xs text-[#2563eb] hover:underline">
                Join Waitlist →
              </a>
            </div>

            {/* Stats row - bottom */}
            <div className="col-span-3 row-start-8 row-span-1 p-4 flex gap-12">
              <div>
                <p className="text-3xl font-light">10x</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Faster context
                  <br />
                  retrieval
                </p>
              </div>
              <div>
                <p className="text-3xl font-light">100%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Source
                  <br />
                  attribution
                </p>
              </div>
              <div>
                <p className="text-3xl font-light">∞</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Team
                  <br />
                  memory
                </p>
              </div>
            </div>

            {/* Bottom right - Blue accent */}
            <div className="col-start-5 col-span-2 row-start-7 row-span-2 bg-[#2563eb] flex items-center justify-center">
              {/* Asterisk symbol */}
              <span className="text-white text-4xl">✳</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
