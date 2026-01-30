import NextLink from "next/link";

import { emailConfig, siteConfig } from "@repo/site-config";
import { Icons } from "@repo/ui/components/icons";
import { Lissajous } from "./lissajous";

// Different Lissajous patterns for each column (defined inline to avoid client/server boundary issues)
const FOOTER_PATTERNS = [
  { a: 1, b: 1, delta: Math.PI / 2 },     // circle
  { a: 1, b: 2, delta: Math.PI / 2 },     // figure8
  { a: 3, b: 2, delta: Math.PI / 2 },     // pretzel
  { a: 2, b: 3, delta: Math.PI / 2 },     // bow
  { a: 3, b: 4, delta: Math.PI / 2 },     // knot
  { a: 5, b: 4, delta: Math.PI / 2 },     // star
  { a: 1, b: 3, delta: Math.PI / 4 },     // wave
  { a: 2, b: 1, delta: Math.PI / 2 },     // infinity
  { a: 3, b: 1, delta: Math.PI / 2 },     // clover
];

export function AppFooter() {
  return (
    <footer className="dark w-full bg-background text-foreground">
      <div className="w-full px-8 md:px-16 lg:px-24">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 lg:grid-cols-[1fr_140px_140px_140px] gap-8 lg:gap-12 pt-16 pb-32">
          {/* Logo - first column */}
          <div className="col-span-2 lg:col-span-1">
            <NextLink href="/" aria-label="Lightfast">
              <Icons.logoShort className="h-4 w-auto text-foreground" />
            </NextLink>
          </div>

          {/* Product Column */}
          <div className="flex flex-col gap-3">
            <h3 className="text-foreground text-sm font-medium">Product</h3>
            <nav className="flex flex-col gap-2">
              <NextLink
                href="/pricing"
                className="text-foreground hover:text-muted-foreground text-sm transition-colors"
              >
                Pricing
              </NextLink>
              <NextLink
                href="/blog"
                className="text-foreground hover:text-muted-foreground text-sm transition-colors"
              >
                Blog
              </NextLink>
              <NextLink
                href="/changelog"
                className="text-foreground hover:text-muted-foreground text-sm transition-colors"
              >
                Changelog
              </NextLink>
            </nav>
          </div>

          {/* Resources Column */}
          <div className="flex flex-col gap-3">
            <h3 className="text-foreground text-sm font-medium">Resources</h3>
            <nav className="flex flex-col gap-2">
              <NextLink
                href="/docs/get-started/overview"
                className="text-foreground hover:text-muted-foreground text-sm transition-colors"
              >
                Documentation
              </NextLink>
              <NextLink
                href="/early-access"
                className="text-foreground hover:text-muted-foreground text-sm transition-colors"
              >
                Early Access
              </NextLink>
              <NextLink
                href="/docs/api-reference/overview"
                className="text-foreground hover:text-muted-foreground text-sm transition-colors"
              >
                API Reference
              </NextLink>
            </nav>
          </div>

          {/* Connect Column */}
          <div className="flex flex-col gap-3">
            <h3 className="text-foreground text-sm font-medium">Connect</h3>
            <nav className="flex flex-col gap-2">
              <NextLink
                href={siteConfig.links.twitter.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-muted-foreground text-sm transition-colors"
              >
                Twitter
              </NextLink>
              <NextLink
                href={siteConfig.links.github.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-muted-foreground text-sm transition-colors"
              >
                GitHub
              </NextLink>
              <NextLink
                href={siteConfig.links.discord.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-muted-foreground text-sm transition-colors"
              >
                Discord
              </NextLink>
            </nav>
          </div>
        </div>

        {/* Bottom Bar - same grid structure for alignment */}
        <div className="grid grid-cols-2 lg:grid-cols-[1fr_140px_140px_140px] gap-8 lg:gap-12 py-6">
          {/* Copyright - first column */}
          <p className="text-muted-foreground text-sm col-span-2 lg:col-span-1">
            © {siteConfig.name} {new Date().getFullYear()}
          </p>

          {/* Legal Links - aligns with Product column */}
          <nav className="flex items-center gap-6 col-span-2">
            <NextLink
              href={`mailto:${emailConfig.hello}`}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Contact
            </NextLink>
            <NextLink
              href="/legal/privacy"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Privacy
            </NextLink>
            <NextLink
              href="/legal/terms"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Terms
            </NextLink>
          </nav>

          {/* Location - aligns with Connect column */}
          <p className="text-muted-foreground text-sm text-right">
            Built in Melbourne
          </p>
        </div>
      </div>

      {/* Grid row - matches hero section style */}
      <div className="w-full py-16 px-8 md:px-16 lg:px-24">
        <div className="grid grid-cols-4 md:grid-cols-9 gap-[8px] border border-border">
          {Array.from({ length: 9 }).map((_, colIdx) => {
            const col = colIdx + 1;
            const isMobileVisible = col <= 4;
            const isLeftEdge = col === 1;
            const isRightEdgeDesktop = col === 9;
            const isRightEdgeMobile = col === 4;

            const borderClasses = [
              !isLeftEdge && "border-l border-l-border",
              !isRightEdgeMobile && col <= 4 && "border-r border-r-border",
              isRightEdgeMobile &&
                !isRightEdgeDesktop &&
                "md:border-r md:border-r-border",
              col > 4 && !isRightEdgeDesktop && "border-r border-r-border",
            ]
              .filter(Boolean)
              .join(" ");

            const visibilityClass = !isMobileVisible ? "hidden md:block" : "";

            const pattern = FOOTER_PATTERNS[colIdx];

            return (
              <div
                key={`footer-cell-${col}`}
                className={`bg-background aspect-square ${borderClasses} ${visibilityClass} flex items-center justify-center p-4`}
              >
                <Lissajous
                  a={pattern.a}
                  b={pattern.b}
                  delta={pattern.delta}
                  className="w-full h-full"
                  stroke="var(--border)"
                  strokeWidth={1.5}
                />
              </div>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
