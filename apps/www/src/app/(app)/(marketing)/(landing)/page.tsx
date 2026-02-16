import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Search, RefreshCw, Users, Zap, Link2, Shield } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { faqs, FAQSection } from "~/components/faq-section";
import { DitheredBackground } from "~/components/dithered-background";
import { IntegrationShowcase } from "~/components/integration-showcase";
import { PlatformAccessCards } from "~/components/platform-access-cards";
import { ChangelogPreview } from "~/components/changelog-preview";
import { HeroChangelogBadge } from "~/components/hero-changelog-badge";
import { FeatureVisualsTabs } from "~/components/feature-visuals-tabs";
import { UnicornScene } from "~/components/unicorn-scene";
import { LissajousHero } from "~/components/lissajous-hero";
import { GridSection } from "~/components/grid-section";
import { WorkflowVisual } from "~/components/landing/workflow-visual";
import { SearchDemo } from "~/components/search-demo";
import { WaitlistCTA } from "~/components/waitlist-cta";
import { exposureTrial } from "~/lib/fonts";

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

// Debug flag: set to true to display row/col coordinates in each grid cell
const SHOW_GRID_LABELS = false;

// Flag to disable the grid system for hero section
const DISABLE_HERO_GRID = true;

// Flag to disable the right-side layered cards in the hero
const DISABLE_HERO_CARDS = true;

// Section visibility flags
const SHOW_HERO_SECTION = true;
const SHOW_INTRODUCING_SECTION = false;
const SHOW_WORKFLOW_SECTION = false;
const SHOW_INTEGRATIONS_SECTION = true;
const SHOW_FEATURE_VISUALS_SECTION = false;
const SHOW_CONNECT_TOOLS_SECTION = false;
const SHOW_FAQ_SECTION = true;
const SHOW_CHANGELOG_SECTION = false;
const SHOW_CTA_SECTION = true;
const SHOW_UNICORN_SECTION = false;

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
      <div className="min-h-screen bg-background flex flex-col items-center max-w-[1400px] mx-auto px-8 md:px-16 lg:px-24">
        {/* Hero Section */}
        {SHOW_HERO_SECTION &&
          (DISABLE_HERO_GRID ? (
            /* Full-width hero without grid - Lightfield style */
            <section className="relative ml-[calc(50%-50dvw)] min-h-screen w-[100dvw] bg-background overflow-hidden">
              {/* Hero visual - overflow wrapper clips the image at section edges */}
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                {/* Inner container: width/height control size, top/right control position.
                    Changing top/right only MOVES the image without distorting it. */}
                <div
                  className="absolute"
                  style={{
                    width: '80%',
                    height: '95%',
                    top: '5%',
                    right: '-12.5%',
                  }}
                >
                  <Image
                    src="/images/landing-hero.gif"
                    alt="Data flows through the Lightfast engine"
                    fill
                    priority
                    unoptimized
                    quality={100}
                    className="object-contain object-right-top"
                  />
                </div>
              </div>

              {/* Hero text - positioned on the left */}
              <div className="relative z-20 mx-auto flex w-full max-w-[1400px] items-center min-h-screen px-8 pb-24 md:px-16 md:pb-32 lg:px-24 lg:pb-40">
                <div className="flex max-w-[420px] flex-col justify-center">
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

            <div
              className="z-10 flex items-center justify-center"
              style={{ gridColumn: 3, gridRow: 2 }}
            >
              Content in cell 2-3
            </div>

            -----------------------------------------------------------------------------------
            METHOD 2: Spanning Multiple Cells (Rectangle)
            -----------------------------------------------------------------------------------
            Content spans a rectangular region of cells.
            Use "start / end" syntax (end is exclusive).

            <div
              className="z-10 flex items-center justify-center"
              style={{
                gridColumn: "2 / 5",  // cols 2, 3, 4 (ends before 5)
                gridRow: "2 / 4",     // rows 2, 3 (ends before 4)
              }}
            >
              Spans 3 cols x 2 rows
            </div>

            -----------------------------------------------------------------------------------
            METHOD 3: Solid Color Block
            -----------------------------------------------------------------------------------
            Overlay a solid background color that covers grid lines.

            <div
              className="bg-[var(--brand-blue)] z-10"
              style={{
                gridColumn: "6 / 9",  // cols 6, 7, 8
                gridRow: "2 / 5",     // rows 2, 3, 4
              }}
            />

            -----------------------------------------------------------------------------------
            METHOD 4: Complex Shapes (L-shape, etc.) with clip-path
            -----------------------------------------------------------------------------------
            For non-rectangular shapes, use clip-path on a bounding box container.

            Example: L-shape covering cells 2-6 to 2-8, 3-5 to 4-8
            Bounding box: cols 5-8, rows 2-4 (4 cols x 3 rows)
            Cut out: top-left cell (25% width x 33.33% height)

            <div
              className="z-10 relative overflow-hidden"
              style={{
                gridColumn: "5 / 9",
                gridRow: "2 / 5",
                clipPath: "polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 33.33%, 25% 33.33%)",
              }}
            >
              <Image src="..." fill className="object-cover" />
            </div>

            Clip-path percentages = (cells to cut / total cells) x 100
            - Width: 1 col / 4 cols = 25%
            - Height: 1 row / 3 rows = 33.33%

            -----------------------------------------------------------------------------------
            METHOD 5: Multiple Overlapping Blocks (Alternative to clip-path)
            -----------------------------------------------------------------------------------
            For solid colors, use multiple overlapping divs instead of clip-path.
            Ensure blocks overlap by 1+ column/row to hide seams.

            // Right portion
            <div
              className="bg-[var(--brand-blue)] z-10"
              style={{ gridColumn: "6 / 9", gridRow: "2 / 5" }}
            />
            // Left extension - overlaps col 6 to hide seam
            <div
              className="bg-[var(--brand-blue)] z-10"
              style={{ gridColumn: "5 / 7", gridRow: "3 / 5" }}
            />

            -----------------------------------------------------------------------------------
            METHOD 6: Responsive Content (Mobile vs Desktop)
            -----------------------------------------------------------------------------------
            Mobile: 4 cols (1-4) | Desktop: 8 cols (1-8)
            Use "hidden md:block" for desktop-only content.
            Use "md:hidden" for mobile-only content.

            // Desktop only - cols 5-8 don't exist on mobile
            <div
              className="z-10 hidden md:block"
              style={{ gridColumn: "5 / 9", gridRow: "2 / 4" }}
            >
              Desktop content
            </div>

            // Different positions per breakpoint
            <div
              className="z-10 col-start-1 col-span-4 md:col-start-2 md:col-span-3"
              style={{ gridRow: 1 }}
            >
              Responsive positioning
            </div>

            -----------------------------------------------------------------------------------
            METHOD 7: Borderless Zone (Removing Grid Lines)
            -----------------------------------------------------------------------------------
            Use the borderlessZone Set (defined above grid cells) to remove internal
            grid lines between specific cells, creating a unified region.

            CRITICAL: When adding content overlays, ALWAYS remove covered cells from
            the borderlessZone. The content overlay handles hiding grid lines for
            those cells - keeping them in borderlessZone is redundant.

            Checklist when adding content:
            1. List all cells your content will cover
            2. Remove those cells from borderlessZone Set
            3. Add comment explaining why cells were removed
            4. Add your content overlay with appropriate z-10

            Example workflow:
            - Want to add image covering 2-4, 3-3, 4-3
            - Go to borderlessZone Set definition
            - Remove "2-4", "3-3", "4-3" from the Set
            - Add content overlay in Content Layer section

            -----------------------------------------------------------------------------------
            TIPS
            -----------------------------------------------------------------------------------
            - Always use z-10 for content to overlay grid cell backgrounds
            - Grid lines are created by cell borders + 2px gap
            - Content blocks cover grid lines (no borders visible inside block)
            - Use SHOW_GRID_LABELS = true to see cell coordinates while developing
            - For images: use "relative overflow-hidden" on container + "fill" on Image
            - gridColumn/gridRow end values are EXCLUSIVE (use n+1 for last cell)
            - ALWAYS update borderlessZone when adding/removing content overlays
            - Keep borderlessZone and content overlays in sync to avoid visual bugs
          */}

              {/* Hero text - spans cells 2-1, 2-2, 2-3, 2-4 */}
              <div
                className="z-10 flex items-center relative"
                style={{
                  gridColumn: "1 / 5",
                  gridRow: 2,
                }}
              >
                {/* Top-left corner accent */}
                <div className="absolute top-0 left-0 w-2 h-2">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-[var(--pitch-deck-red)]" />
                  <div className="absolute top-0 left-0 w-[1px] h-full bg-[var(--pitch-deck-red)]" />
                </div>
                {/* Bottom-right corner accent */}
                <div className="absolute bottom-0 right-0 w-2 h-2">
                  <div className="absolute bottom-0 right-0 w-full h-[1px] bg-[var(--pitch-deck-red)]" />
                  <div className="absolute bottom-0 right-0 w-[1px] h-full bg-[var(--pitch-deck-red)]" />
                </div>
                <h1
                  className={`text-2xl md:text-4xl px-4 ${exposureTrial.className}`}
                >
                  <span className="text-muted-foreground">The</span>{" "}
                  <span className="text-primary">Memory Layer</span>{" "}
                  <span className="text-muted-foreground">
                    for Software Teams and AI Agents
                  </span>
                </h1>
              </div>

              {/* Dithered background overlay - complex L-shape */}
              {/* <div
            className="z-10 hidden md:block overflow-hidden"
            style={{
              gridColumn: "4 / 10", // cols 4-9 (bounding box)
              gridRow: "1 / 7", // rows 1-6 (bounding box)
              clipPath:
                "polygon(50% 0%, 83.33% 0%, 83.33% 16.67%, 100% 16.67%, 100% 100%, 33.33% 100%, 33.33% 83.33%, 0% 83.33%, 0% 50%, 16.67% 50%, 16.67% 33.33%, 33.33% 33.33%, 33.33% 16.67%, 50% 16.67%)",
            }}
          >
            <DitheredBackground />
          </div> */}

              {/* Hero visual - Workflow demonstration */}
              <div
                className="z-10 hidden md:block overflow-hidden relative"
                style={{
                  gridColumn: "5 / 10", // cols 5-9 (right side)
                  gridRow: "1 / 8", // rows 1-7 (full height)
                }}
              >
                <WorkflowVisual />
              </div>
            </section>
          ))}

        {/* Introducing Section */}
        {SHOW_INTRODUCING_SECTION && (
          <section className="w-full bg-background py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16 mb-16">
              {/* Left: Badge */}
              <div>
                <span className="inline-flex items-center h-7 px-3 rounded-md border border-border text-xs text-muted-foreground">
                  Introducing Lightfast
                  </span>
                </div>

                {/* Right: Content - spans 2 columns */}
                <div className="lg:col-span-2 max-w-xl">
                  <p className="text-base md:text-lg leading-relaxed mb-6">
                    <span className="text-foreground font-normal">
                      Engineering teams lose hours searching for context.
                    </span>{" "}
                    <span className="text-muted-foreground">
                      Instead of building, they dig through Slack threads, stale
                      docs, and scattered PRs trying to understand decisions
                      that were made months ago.
                    </span>
                  </p>
                  <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                    That&apos;s why we built Lightfast — the first memory layer
                    for software teams. It indexes everything your team knows,
                    surfaces answers with sources, and gives your agents the
                    context they need to actually help.
                  </p>
                </div>
              </div>

              {/* Lissajous Hero */}
            <Link
              href="/blog/announcing-lightfast"
              className="block w-full rounded-sm overflow-hidden"
            >
              <LissajousHero />
            </Link>
          </section>
        )}

        {/* Workflow Section */}
        {SHOW_WORKFLOW_SECTION && (
          <section className="w-full bg-background py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16 mb-8">
              {/* Left: Badge */}
              <div>
                <span className="inline-flex items-center h-7 px-3 rounded-md border border-border text-xs text-muted-foreground">
                  AI Agents That Know Your Context
                  </span>
                </div>

                {/* Right: Content - spans 2 columns */}
                <div className="lg:col-span-2 max-w-xl">
                  <p className="text-base md:text-lg leading-relaxed mb-6">
                    <span className="text-foreground font-normal">
                      Watch how AI agents use Lightfast to understand your
                      business.
                    </span>{" "}
                    <span className="text-muted-foreground">
                      From prospect data to past interactions, agents can search
                      your entire knowledge base to take action on your behalf.
                    </span>
                  </p>
                </div>
              </div>

            {/* Workflow Visual */}
            <div className="w-full h-[600px] rounded-lg overflow-hidden border border-border">
              <WorkflowVisual />
            </div>
          </section>
        )}

        {/* Integrations Section */}
        {SHOW_INTEGRATIONS_SECTION && (
          <section className="w-full py-16">
            <IntegrationShowcase />
          </section>
        )}

        {/* Feature Visuals Section */}
        {SHOW_FEATURE_VISUALS_SECTION && (
          <section className="dark w-full min-h-screen bg-background relative overflow-hidden">
            {/* Content - full width, left-aligned like hero */}
            <div className="w-full py-24 relative z-10">
              <FeatureVisualsTabs />
            </div>
            {/* Platform Access Cards with dither background */}
            <div className="relative mt-32">
              {/* Cards */}
              <div className="relative z-10 w-full">
                <PlatformAccessCards />
              </div>
              {/* Gradient background - full width, pulled up to overlap cards */}
              <div className="relative w-screen h-[500px] -mt-[150px] left-1/2 -translate-x-1/2">
                <Image
                  src="/images/nascent_remix.webp"
                  alt="Lightfast visual background"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </section>
        )}

        {/* Connect Your Tools Section */}
        {SHOW_CONNECT_TOOLS_SECTION && (
          <section className="w-full bg-background py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16">
              {/* Left: Badge */}
              <div>
                <span className="inline-flex items-center h-7 px-3 rounded-md border border-border text-xs text-muted-foreground">
                  Connect Your Tools
                  </span>
                </div>

                {/* Right: Content + Cards - spans 2 columns */}
                <div className="lg:col-span-2">
                  <p className="text-base md:text-lg leading-relaxed text-muted-foreground max-w-xl mb-12">
                    Pull in knowledge from where your team already works.
                    GitHub, Linear, Notion, Slack, and more—all searchable in
                    one place.
                  </p>

                  {/* Benefits Grid - negative margin to align icon/title with text above */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 -ml-8">
                    {benefits.map((benefit) => {
                      const Icon = benefit.icon;
                      return (
                        <div
                          key={benefit.title}
                          className="border border-border rounded-none p-8"
                        >
                          <div className="mb-4">
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
          </section>
        )}

        {/* FAQ Section */}
        {SHOW_FAQ_SECTION && (
          <section className="w-full bg-background py-24 md:py-32">
            <FAQSection />
          </section>
        )}

        {/* Changelog Preview */}
        {SHOW_CHANGELOG_SECTION && (
          <section className="w-full bg-background py-24 md:py-32">
            <ChangelogPreview />
          </section>
        )}
      </div>

      {/* CTA Section */}
      {SHOW_CTA_SECTION && <WaitlistCTA />}

      {/* Unicorn Studio Section */}
      {SHOW_UNICORN_SECTION && (
        <section className="w-full">
          <div className="h-[600px] border border-border rounded-xs overflow-hidden">
            <UnicornScene
              projectId="l4I4U2goI9votcrBdYG1"
              className="w-full h-full"
            />
          </div>
        </section>
      )}
    </>
  );
}
