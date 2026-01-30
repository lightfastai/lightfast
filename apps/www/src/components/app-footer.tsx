"use client";

import NextLink from "next/link";

import { emailConfig, siteConfig } from "@repo/site-config";
import { Icons } from "@repo/ui/components/icons";
import { GridSection } from "./grid-section";
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 pt-16 pb-32">
          {/* Logo - left column */}
          <div>
            <NextLink href="/" aria-label="Lightfast">
              <Icons.logoShort className="h-4 w-auto text-foreground" />
            </NextLink>
          </div>

          {/* Nav columns - right column with nested 3-column grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
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
        </div>

        {/* Bottom Bar - same grid structure for alignment */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 py-6">
          {/* Copyright - left column */}
          <p className="text-muted-foreground text-sm">
            © {siteConfig.name} {new Date().getFullYear()}
          </p>

          {/* Right column with nested 3-column grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Col 1: Legal links (aligns with Product nav above) */}
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 col-span-2 lg:col-span-1">
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

            {/* Col 2: Empty spacer (aligns with Resources nav above) */}
            <div className="hidden lg:block" />

            {/* Col 3: Location (aligns with Connect nav above) */}
            <p className="text-muted-foreground text-sm">
              Built in Melbourne
            </p>
          </div>
        </div>
      </div>

      {/* Grid row - matches hero section style */}
      <div className="w-full py-16 px-8 md:px-16 lg:px-24">
        <GridSection
          rows={1}
          cols={9}
          borderVariant="double-line"
          renderCell={(_row, col) => {
            const pattern = FOOTER_PATTERNS[col - 1]; // 1-indexed to 0-indexed
            if (!pattern) return null;
            return (
              <div className="flex items-center justify-center p-4 w-full h-full">
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
          }}
        />
      </div>
    </footer>
  );
}
