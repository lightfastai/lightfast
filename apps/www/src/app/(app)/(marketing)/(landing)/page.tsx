import type { Metadata } from "next";
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
      <div className="min-h-screen bg-background flex items-center justify-center py-8">
        {/* Hero Section with Grid - square cells maintained via aspect-ratio */}
        {/* Desktop: 8 cols × 6 rows, aspect-ratio 8/6 = 4:3 */}
        {/* Mobile: 4 cols × 6 rows, aspect-ratio 4/6 = 2:3 */}
        {/* Gap creates double-line effect: bg-border/50 shows through the 3px gaps */}
        <section
          className="relative w-full md:aspect-[8/6] aspect-[4/6] max-w-7xl mx-auto
            grid grid-cols-4 md:grid-cols-8 grid-rows-6
            gap-[3px] bg-border/50 border border-border/50"
        >
          {/*
            Grid Cell System:
            - Cells are addressable by row (1-6) and column (1-4 mobile, 1-8 desktop)
            - Use data-cell="row-col" for debugging
            - Content can be placed directly inside cells OR overlay with grid positioning

            To place content in a specific cell:
            1. Find the cell by data-cell attribute
            2. Add content as children

            To span multiple cells (overlay approach):
            - Add a positioned element with col-start-X col-span-Y row-start-X row-span-Y
            - Example: <div className="col-start-2 col-span-3 row-start-2 row-span-2 z-10">
          */}

          {/* Visual grid cells - these create the cell backgrounds */}
          {Array.from({ length: 6 }).map((_, rowIdx) => {
            const row = rowIdx + 1; // 1-indexed for grid positioning
            return Array.from({ length: 8 }).map((_, colIdx) => {
              const col = colIdx + 1; // 1-indexed for grid positioning
              const isMobileVisible = col <= 4;

              return (
                <div
                  key={`cell-${row}-${col}`}
                  data-cell={`${row}-${col}`}
                  className={`bg-background ${!isMobileVisible ? "hidden md:block" : ""}`}
                  style={{
                    gridRow: row,
                    gridColumn: col,
                  }}
                />
              );
            });
          })}

          {/*
            Content Layer - add content items here with explicit grid positioning
            Example usage:

            <div
              className="z-10 flex items-center justify-center"
              style={{ gridColumn: "2 / 4", gridRow: "2 / 4" }}
            >
              Hero Title Here
            </div>
          */}
        </section>
      </div>
    </>
  );
}
