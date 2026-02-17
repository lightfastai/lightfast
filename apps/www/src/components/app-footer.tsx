"use client";

import NextLink from "next/link";

import { emailConfig, siteConfig } from "@repo/site-config";
import { Icons } from "@repo/ui/components/icons";
import { Lissajous } from "./lissajous";

// Different Lissajous patterns for each column (defined inline to avoid client/server boundary issues)
const FOOTER_PATTERNS = [
  { a: 1, b: 1, delta: Math.PI / 2 }, // circle
  { a: 1, b: 2, delta: Math.PI / 2 }, // figure8
  { a: 3, b: 2, delta: Math.PI / 2 }, // pretzel
  { a: 2, b: 3, delta: Math.PI / 2 }, // bow
  { a: 3, b: 4, delta: Math.PI / 2 }, // knot
  { a: 5, b: 4, delta: Math.PI / 2 }, // star
  { a: 1, b: 3, delta: Math.PI / 4 }, // wave
  { a: 2, b: 1, delta: Math.PI / 2 }, // infinity
  { a: 3, b: 1, delta: Math.PI / 2 }, // clover
];

export function AppFooter() {
  return (
    <footer className="dark w-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 pt-16 pb-16">
          {/* Logo - left column */}
          <div>
            <NextLink href="/" aria-label="Lightfast">
              <Icons.logoShort className="h-4 w-auto text-muted-foreground" />
            </NextLink>
          </div>

          {/* Nav columns - right column with nested 3-column grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Product Column */}
            <div className="flex flex-col gap-3">
              <h3 className="text-muted-foreground text-sm font-medium">
                Product
              </h3>
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
              <h3 className="text-muted-foreground text-sm font-medium">
                Resources
              </h3>
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
              <h3 className="text-muted-foreground text-sm font-medium">
                Connect
              </h3>
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

        {/* Bottom Bar */}
        <div className="flex flex-col gap-4 py-6 lg:grid lg:grid-cols-2 lg:gap-12">
          {/* Copyright */}
          <p className="text-muted-foreground text-sm">
            © {siteConfig.name} {new Date().getFullYear()}
          </p>

          {/* Row 2 on mobile: Legal links / On desktop: right column */}
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
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

            {/* Spacer (desktop only) */}
            <div className="hidden lg:block" />

            {/* Location (desktop only, mobile shown above) */}
            <p className="hidden lg:block text-muted-foreground text-sm">
              Built in Melbourne
            </p>
          </div>
        </div>
      </div>

      {/* Lissajous patterns grid */}
      <div className="hidden md:block mx-auto w-full max-w-[1400px] md:pt-32 md:pb-16 md:px-16 lg:px-24">
        <div className="grid grid-cols-3 md:grid-cols-9 gap-4">
          {FOOTER_PATTERNS.map((pattern, index) => (
            <div
              key={index}
              className="aspect-square border border-border flex items-center justify-center p-4"
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
          ))}
        </div>
      </div>
    </footer>
  );
}
