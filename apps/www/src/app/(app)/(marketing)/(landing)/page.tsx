import type { Metadata } from "next";
import { faqs } from "~/components/faq-section";
import { DitheredBackground } from "~/components/dithered-background";
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
const SHOW_GRID_LABELS = true;

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
      <div className="min-h-screen bg-background flex justify-center">
        {/* Hero Section with Grid - square cells via aspect-square on each cell */}
        {/* Desktop: 9 cols × 7 rows | Mobile: 4 cols × 7 rows */}
        {/*
          Double-line grid effect:
          - Gap (8px) between cells creates space for double lines
          - Each cell has borders on sides facing other cells
          - Cell border + gap + adjacent cell border = double line
          - Edge cells have no outward border, keeping outer edge single-lined
        */}
        <section
          className="relative w-full max-w-7xl mx-auto h-fit
            grid grid-cols-4 md:grid-cols-9 content-start
            gap-[8px] border border-border/50"
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
            const borderlessZone = new Set([
              // Row 1: cols 1-5 (image now starts at col 6)
              "1-1",
              "1-2",
              "1-3",
              "1-4",
              "1-5",
              // Row 2: cols 1-4 (image now starts at col 5)
              "2-1",
              "2-2",
              "2-3",
              "2-4",
              // Row 3: cols 1-3 (image now starts at col 4)
              "3-1",
              "3-2",
              "3-3",
              // Row 4: cols 1-3 (image now starts at col 4)
              "4-1",
              "4-2",
              "4-3",
              // Row 5: cols 1-3 (image now starts at col 4)
              "5-1",
              "5-2",
              "5-3",
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
                    "border-t border-t-border/50",
                  // Bottom border: all except bottom edge, skip if both cells in borderless zone
                  !isBottomEdge &&
                    !(inZone && belowInZone) &&
                    "border-b border-b-border/50",
                  // Left border: all except left edge, skip if both cells in borderless zone
                  !isLeftEdge &&
                    !(inZone && leftInZone) &&
                    "border-l border-l-border/50",
                  // Right border: complex responsive logic, skip if both cells in borderless zone
                  // Mobile: cols 1-3 have right border, col 4 doesn't
                  // Desktop: cols 1-8 have right border, col 9 doesn't
                  !isRightEdgeMobile &&
                    col <= 4 &&
                    !(inZone && rightInZone) &&
                    "border-r border-r-border/50",
                  isRightEdgeMobile &&
                    !isRightEdgeDesktop &&
                    !(inZone && rightInZone) &&
                    "md:border-r md:border-r-border/50",
                  col > 4 &&
                    !isRightEdgeDesktop &&
                    !(inZone && rightInZone) &&
                    "border-r border-r-border/50",
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

          {/* Dithered background overlay - complex L-shape */}
          <div
            className="z-10 hidden md:block overflow-hidden"
            style={{
              gridColumn: "4 / 10", // cols 4-9 (bounding box)
              gridRow: "1 / 7", // rows 1-6 (bounding box)
              clipPath:
                "polygon(33.33% 0%, 83.33% 0%, 83.33% 16.67%, 100% 16.67%, 100% 100%, 33.33% 100%, 33.33% 83.33%, 0% 83.33%, 0% 33.33%, 16.67% 33.33%, 16.67% 16.67%, 33.33% 16.67%)",
            }}
          >
            <DitheredBackground />
          </div>
        </section>
      </div>
    </>
  );
}
