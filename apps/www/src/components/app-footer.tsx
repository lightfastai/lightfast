import NextLink from "next/link";

import { Icons } from "@repo/ui/components/icons";
import { LISSAJOUS_PATHS } from "~/lib/generated/lissajous-paths";

export function AppFooter() {
  return (
    <footer className="dark w-full h-full flex flex-col bg-background text-foreground">
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
                  href="https://x.com/lightfastai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-muted-foreground text-sm transition-colors"
                >
                  Twitter
                </NextLink>
                <NextLink
                  href="https://github.com/lightfastai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-muted-foreground text-sm transition-colors"
                >
                  GitHub
                </NextLink>
                <NextLink
                  href="https://discord.gg/YqPDfcar2C"
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
            © Lightfast {new Date().getFullYear()}
          </p>

          {/* Row 2 on mobile: Legal links / On desktop: right column */}
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <NextLink
                href="mailto:hello@lightfast.ai"
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
      <div className="hidden md:block mt-auto mx-auto w-full max-w-[1400px] md:py-16 md:px-16 lg:px-24">
        <div className="grid grid-cols-3 md:grid-cols-9 gap-4">
          {LISSAJOUS_PATHS.map((pattern) => (
            <div
              key={pattern.name}
              className="aspect-square border border-border flex items-center justify-center p-4"
            >
              <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
              >
                <path
                  d={pattern.d}
                  stroke="var(--border)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
