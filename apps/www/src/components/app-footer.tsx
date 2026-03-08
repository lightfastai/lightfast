import { Icons } from "@repo/ui/components/icons";
import NextLink from "next/link";
import { LISSAJOUS_PATHS } from "~/lib/generated/lissajous-paths";

export function AppFooter() {
  return (
    <footer className="dark flex h-full w-full flex-col bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 gap-8 pt-16 pb-16 lg:grid-cols-2 lg:gap-12">
          {/* Logo - left column */}
          <div>
            <NextLink aria-label="Lightfast" href="/">
              <Icons.logoShort className="h-4 w-auto text-muted-foreground" />
            </NextLink>
          </div>

          {/* Nav columns - right column with nested 3-column grid */}
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-3">
            {/* Product Column */}
            <div className="flex flex-col gap-3">
              <h3 className="font-medium text-muted-foreground text-sm">
                Product
              </h3>
              <nav className="flex flex-col gap-2">
                <NextLink
                  className="text-foreground text-sm transition-colors hover:text-muted-foreground"
                  href="/pricing"
                >
                  Pricing
                </NextLink>
                <NextLink
                  className="text-foreground text-sm transition-colors hover:text-muted-foreground"
                  href="/blog"
                >
                  Blog
                </NextLink>
                <NextLink
                  className="text-foreground text-sm transition-colors hover:text-muted-foreground"
                  href="/changelog"
                >
                  Changelog
                </NextLink>
              </nav>
            </div>

            {/* Resources Column */}
            <div className="flex flex-col gap-3">
              <h3 className="font-medium text-muted-foreground text-sm">
                Resources
              </h3>
              <nav className="flex flex-col gap-2">
                <NextLink
                  className="text-foreground text-sm transition-colors hover:text-muted-foreground"
                  href="/docs/get-started/overview"
                >
                  Documentation
                </NextLink>
                <NextLink
                  className="text-foreground text-sm transition-colors hover:text-muted-foreground"
                  href="/early-access"
                >
                  Early Access
                </NextLink>
                <NextLink
                  className="text-foreground text-sm transition-colors hover:text-muted-foreground"
                  href="/docs/api-reference/overview"
                >
                  API Reference
                </NextLink>
              </nav>
            </div>

            {/* Connect Column */}
            <div className="flex flex-col gap-3">
              <h3 className="font-medium text-muted-foreground text-sm">
                Connect
              </h3>
              <nav className="flex flex-col gap-2">
                <NextLink
                  className="text-foreground text-sm transition-colors hover:text-muted-foreground"
                  href="https://x.com/lightfastai"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Twitter
                </NextLink>
                <NextLink
                  className="text-foreground text-sm transition-colors hover:text-muted-foreground"
                  href="https://github.com/lightfastai"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  GitHub
                </NextLink>
                <NextLink
                  className="text-foreground text-sm transition-colors hover:text-muted-foreground"
                  href="https://discord.gg/YqPDfcar2C"
                  rel="noopener noreferrer"
                  target="_blank"
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
                className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                href="mailto:hello@lightfast.ai"
              >
                Contact
              </NextLink>
              <NextLink
                className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                href="/legal/privacy"
              >
                Privacy
              </NextLink>
              <NextLink
                className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                href="/legal/terms"
              >
                Terms
              </NextLink>
            </nav>

            {/* Spacer (desktop only) */}
            <div className="hidden lg:block" />

            {/* Location (desktop only, mobile shown above) */}
            <p className="hidden text-muted-foreground text-sm lg:block">
              Built in Melbourne
            </p>
          </div>
        </div>
      </div>

      {/* Lissajous patterns grid */}
      <div className="mx-auto mt-auto hidden w-full max-w-[1400px] md:block md:px-16 md:py-16 lg:px-24">
        <div className="grid grid-cols-3 gap-4 md:grid-cols-9">
          {LISSAJOUS_PATHS.map((pattern) => (
            <div
              className="flex aspect-square items-center justify-center border border-border p-4"
              key={pattern.name}
            >
              <svg
                className="h-full w-full"
                fill="none"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d={pattern.d}
                  stroke="var(--border)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
