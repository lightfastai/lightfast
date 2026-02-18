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
import { JsonLd } from "@vendor/seo/json-ld";
import type {GraphContext, Organization, WebSite, SoftwareApplication, FAQPage, Question} from "@vendor/seo/json-ld";

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

      {/* Grid-based landing page */}
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
<<<<<<< Updated upstream
        <section className="relative min-h-screen w-full bg-background overflow-hidden">
          {/* Hero visual - overflow wrapper clips the image at section edges */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            {/* Inner container: width/height control size, top/right control position.
                Changing top/right only MOVES the image without distorting it.
                Mobile: larger + centered lower. Tablet: intermediate. Desktop: original. */}
=======
        {SHOW_HERO_SECTION &&
          (DISABLE_HERO_GRID ? (
            /* Full-width hero without grid - Lightfield style */
            <section className="relative ml-[calc(50%-50dvw)] min-h-screen w-[100dvw] bg-background overflow-hidden">
              <div className="pointer-events-none absolute inset-0 z-0">
                <Image
                  src="/images/landing-hero.gif"
                  alt="Data flows through the Lightfast engine"
                  fill
                  priority
                  unoptimized
                  quality={100}
                  sizes="100vw"
                  className="object-cover [object-position:112%_center] scale-[1.12] origin-center"
                />
              </div>
              {/*
                Hero layout: CSS Grid with 12 columns
                - Mobile/Tablet: single column with padding, cards stack vertically
                - Desktop (lg+): left text (~35%) + right visuals (~65%), visuals allowed to bleed right
                Cards sit in the ~40-100%+ horizontal zone of the viewport.
              */}
              <div className="relative z-20 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-8 px-8 min-h-screen pb-24 md:px-16 md:pb-32 lg:grid-cols-12 lg:gap-0 lg:px-24 lg:pb-40">
                {/* Hero text - left side (narrower to push visuals right) */}
                <div className="relative z-20 lg:col-span-4 xl:col-span-4 flex max-w-[420px] flex-col justify-center">
                  <Icons.logoShort className="w-5 h-5 mb-4 text-muted-foreground" />
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-pp font-medium mb-4">
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

                {/* Layered workflow visuals - right side, allowed to bleed past viewport */}
                {/* Nested grid: cards shifted right, overlap via shared grid areas */}
                {!DISABLE_HERO_CARDS && (
                  <div className="lg:col-span-9 xl:col-span-8 grid grid-cols-12 grid-rows-6 min-h-[420px] pl-32 md:min-h-[500px] lg:min-h-[560px]">
                    {/* Component 1 - User Query card */}
                    {/* Mobile: full width | Desktop: starts col 2, pushed right */}
                    <div className="col-span-12 md:col-span-8 lg:col-start-2 lg:col-span-7 row-start-2 row-span-1 z-30 self-start">
                      <div className="bg-card backdrop-blur-md rounded-lg shadow-lg px-5 py-3.5 md:px-6 md:py-4">
                        <p className="text-sm md:text-base text-foreground leading-relaxed">
                          when did we decide to use PostgreSQL for the analytics
                          service and what were the reasons?
                        </p>
                      </div>
                    </div>

                    {/* Component 2 - AI Response with workflow steps */}
                    {/* Mobile: full width | Desktop: starts col 1, spans 10 */}
                    <div className="col-span-12 md:col-span-10 lg:col-start-1 lg:col-span-8 row-start-3 row-span-2 z-20 self-start -mt-1 md:-mt-2">
                      <div className="bg-card/40 backdrop-blur-md rounded-lg shadow-lg p-4 md:p-5">
                        {/* Agent Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <Icons.logoShort className="w-5 h-5 text-primary" />
                        </div>

                        {/* Agent Message */}
                        <p className="text-sm md:text-base text-foreground/90 mb-4 leading-relaxed">
                          I&apos;ll help you find when we decided to use
                          PostgreSQL for the analytics service. Let me search
                          through your team&apos;s memory.
                        </p>

                        {/* Workflow Steps - Vertical Pills */}
                        <div className="flex flex-col gap-2">
                          {/* Step 1 - Search */}
                          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                            <Search className="w-3.5 h-3.5 text-primary shrink-0" />
                            <p className="text-xs md:text-sm text-foreground truncate">
                              <span className="font-medium">Search</span>{" "}
                              <span className="text-muted-foreground">
                                all accounts sorted by last interaction date
                                an...
                              </span>
                            </p>
                          </div>

                          {/* Step 2 - Contents */}
                          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                            <RefreshCw className="w-3.5 h-3.5 text-primary shrink-0" />
                            <p className="text-xs md:text-sm text-foreground truncate">
                              <span className="font-medium">Contents</span>{" "}
                              <span className="text-muted-foreground">
                                17 accounts answered – what are the key deta...
                              </span>
                            </p>
                          </div>

                          {/* Step 3 - Graph */}
                          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                            <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <p className="text-xs md:text-sm text-foreground truncate">
                              <span className="font-medium">Graph</span>{" "}
                              <span className="text-muted-foreground">
                                found connections between 8 entities across...
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Component 3 - Search Results */}
                    {/* Mobile: full width | Desktop: cols 5-13 (bleeds right), rows 4-6 */}
                    <div className="col-span-12 md:col-start-3 md:col-span-10 lg:col-start-5 lg:col-span-9 row-start-4 row-span-3 z-10 self-start -mt-2 md:-mt-4">
                      <div className="bg-background/60 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden max-h-[320px] md:max-h-[380px] lg:max-h-[420px]">
                        <SearchDemo />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Changelog badge - pinned to bottom of initial viewport */}
              <div className="absolute inset-x-0 top-0 h-screen pointer-events-none flex items-end pb-8">
                <div className="pointer-events-auto">
                  <HeroChangelogBadge />
                </div>
              </div>
            </section>
          ) : (
            /* Grid-based hero - original implementation */
            /* Hero Section with Grid - square cells via aspect-square on each cell */
            /* Desktop: 9 cols × 7 rows | Mobile: 4 cols × 7 rows */
            /*
            Double-line grid effect:
            - Gap (8px) between cells creates space for double lines
            - Each cell has borders on sides facing other cells
            - Cell border + gap + adjacent cell border = double line
            - Edge cells have no outward border, keeping outer edge single-lined
          */
            <section
              className="relative w-full max-w-7xl mx-auto h-fit
              grid grid-cols-4 md:grid-cols-9 content-start
              gap-[8px] border border-border"
            >
              {/*
            Grid Cell System:
            - Cells are addressable by row (1-7) and column (1-4 mobile, 1-9 desktop)
            - Use data-cell="row-col" for debugging
            - Content can be placed directly inside cells OR overlay with grid positioning

            To place content in a specific cell:
            1. Find the cell by data-cell attribute
            2. Add content as children

            To span multiple cells (overlay approach):
            - Add a positioned element with col-start-X col-span-Y row-start-X row-span-Y
            - Example: <div className="col-start-2 col-span-3 row-start-2 row-span-2 z-10">
          */}

              {/* Visual grid cells - these create the cell backgrounds with double-line borders */}
              {(() => {
                /*
              ===================================================================================
              BORDERLESS ZONE CONFIGURATION
              ===================================================================================

              The borderless zone defines cells where INTERNAL grid lines are removed,
              creating a unified region that appears as one block without visible borders.

              IMPORTANT: Relationship with Content Overlays
              -----------------------------------------------------------------------------------
              When adding content overlays (images, solid colors, etc.) that cover grid cells:

              1. REMOVE cells from borderlessZone that will be covered by the content
                 - Content overlays (z-10) sit on top of cells and hide grid lines anyway
                 - Keeping covered cells in borderlessZone is redundant and can cause issues
                 - The content overlay handles the "borderless" appearance for those cells

              2. KEEP cells in borderlessZone that should appear borderless but have NO overlay
                 - These cells will show their background color without internal grid lines
                 - Useful for creating unified regions that don't have content yet

              Workflow for adding new content:
              -----------------------------------------------------------------------------------
              1. Determine which cells your content will cover
              2. Remove those cells from the borderlessZone Set below
              3. Add your content overlay in the Content Layer section
              4. Use clip-path for complex (non-rectangular) shapes

              Example: If adding content to cells 2-4, 3-3, 4-3:
              - Remove "2-4", "3-3", "4-3" from the Set
              - Add a comment noting why they were removed
            */
                const borderlessZone = new Set<string>([
                  // Row 1: cols 1-5 (image now starts at col 6)
                  // "1-1",
                  // "1-2",
                  // "1-3",
                  // "1-4",
                  // "1-5",
                  // Row 2: cols 1-4 (image now starts at col 5)
                  // "2-1",
                  // "2-2",
                  // "2-3",
                  // "2-4",
                  // Row 3: cols 1-3 (image now starts at col 4)
                  // "3-1",
                  // "3-2",
                  // "3-3",
                  // Row 4: cols 1-3 (image now starts at col 4)
                  // "4-1",
                  // "4-2",
                  // "4-3",
                  // Row 5: cols 1-3 (image now starts at col 4)
                  // "5-1",
                  // "5-2",
                  // "5-3",
                  // Row 6: no borderless cells (image starts at col 5)
                ]);

                const isInBorderlessZone = (r: number, c: number) =>
                  borderlessZone.has(`${r}-${c}`);

                return Array.from({ length: 7 }).map((_, rowIdx) => {
                  const row = rowIdx + 1; // 1-indexed for grid positioning
                  return Array.from({ length: 9 }).map((_, colIdx) => {
                    const col = colIdx + 1; // 1-indexed for grid positioning
                    const isMobileVisible = col <= 4;

                    // Edge detection
                    const isTopEdge = row === 1;
                    const isBottomEdge = row === 7;
                    const isLeftEdge = col === 1;
                    const isRightEdgeDesktop = col === 9;
                    const isRightEdgeMobile = col === 4;

                    // Borderless zone detection - remove borders between cells in the same zone
                    const inZone = isInBorderlessZone(row, col);
                    const aboveInZone = isInBorderlessZone(row - 1, col);
                    const belowInZone = isInBorderlessZone(row + 1, col);
                    const leftInZone = isInBorderlessZone(row, col - 1);
                    const rightInZone = isInBorderlessZone(row, col + 1);

                    // Build border classes for double-line effect
                    // Each cell has borders on sides facing other cells (not edges)
                    // Skip borders between cells that are both in the borderless zone
                    const borderClasses = [
                      // Top border: all except top edge, skip if both cells in borderless zone
                      !isTopEdge &&
                        !(inZone && aboveInZone) &&
                        "border-t border-t-border",
                      // Bottom border: all except bottom edge, skip if both cells in borderless zone
                      !isBottomEdge &&
                        !(inZone && belowInZone) &&
                        "border-b border-b-border",
                      // Left border: all except left edge, skip if both cells in borderless zone
                      !isLeftEdge &&
                        !(inZone && leftInZone) &&
                        "border-l border-l-border",
                      // Right border: complex responsive logic, skip if both cells in borderless zone
                      // Mobile: cols 1-3 have right border, col 4 doesn't
                      // Desktop: cols 1-8 have right border, col 9 doesn't
                      !isRightEdgeMobile &&
                        col <= 4 &&
                        !(inZone && rightInZone) &&
                        "border-r border-r-border",
                      isRightEdgeMobile &&
                        !isRightEdgeDesktop &&
                        !(inZone && rightInZone) &&
                        "md:border-r md:border-r-border",
                      col > 4 &&
                        !isRightEdgeDesktop &&
                        !(inZone && rightInZone) &&
                        "border-r border-r-border",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    // Visibility classes - need to use flex variant for desktop-only cells when showing labels
                    const visibilityClass = !isMobileVisible
                      ? SHOW_GRID_LABELS
                        ? "hidden md:flex"
                        : "hidden md:block"
                      : "";

                    return (
                      <div
                        key={`cell-${row}-${col}`}
                        data-cell={`${row}-${col}`}
                        className={`bg-background aspect-square ${borderClasses} ${visibilityClass} ${SHOW_GRID_LABELS ? "flex items-center justify-center" : ""}`}
                        style={{ gridRow: row, gridColumn: col }}
                      >
                        {SHOW_GRID_LABELS && (
                          <span className="text-xs text-muted-foreground/50 font-mono">
                            {row}-{col}
                          </span>
                        )}
                      </div>
                    );
                  });
                });
              })()}

              {/*
            ===================================================================================
            CONTENT PLACEMENT GUIDE
            ===================================================================================
            Grid: 8 cols x 6 rows (desktop) | 4 cols x 6 rows (mobile)
            Addressing: row-col (1-indexed), e.g., "2-5" = row 2, column 5
            All content uses z-10 to overlay on top of grid cell backgrounds

            -----------------------------------------------------------------------------------
            METHOD 1: Single Cell Content
            -----------------------------------------------------------------------------------
            Place content in exactly one cell.

>>>>>>> Stashed changes
            <div
              className="absolute
                w-[150%] h-[90%] top-[22%] -right-[42%]
                md:w-[100%] md:h-[85%] md:top-[25%] md:-right-[10%]
                lg:w-[80%] lg:h-[95%] lg:top-[5%] lg:-right-[12.5%]"
            >
              <Image
                src="/images/landing-hero.gif"
                alt="Data flows through the Lightfast engine"
                fill
                sizes="(max-width: 768px) 150vw, (max-width: 1024px) 100vw, 80vw"
                priority
                unoptimized
                quality={100}
                className="object-contain object-[65%_25%] md:object-right-top"
              />
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
