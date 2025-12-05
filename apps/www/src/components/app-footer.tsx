import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";

import { emailConfig, siteConfig } from "@repo/site-config";
import { Icons } from "@repo/ui/components/icons";

export function AppFooter() {
  return (
    <footer className="relative w-full text-foreground">
      {/* Section 1 - Logo and Main Footer Links */}
      <section className="relative pb-8 sm:pb-10 lg:pb-12">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Main Links Grid - Full width */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
            {/* Products Column */}
            <div className="flex flex-col">
              <h3 className="text-muted-foreground mb-3 text-base sm:text-lg lg:text-sm font-semibold">
                Product
              </h3>
              <nav className="flex flex-col gap-2">
                <NextLink
                  href="/pricing"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Pricing
                </NextLink>
                <NextLink
                  href="/changelog"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Changelog
                </NextLink>
                <NextLink
                  href="/early-access"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Early Access
                </NextLink>
              </nav>
            </div>

            {/* Platform Column */}
            <div className="flex flex-col">
              <h3 className="text-muted-foreground mb-3 text-base sm:text-lg lg:text-sm font-semibold">
                Platform
              </h3>
              <nav className="flex flex-col gap-2">
                <MicrofrontendLink
                  href="/sign-in"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Sign In
                </MicrofrontendLink>
                <NextLink
                  href="https://chat.lightfast.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200 inline-flex items-center gap-1"
                >
                  Chat Demo
                  <span className="text-xs">↗</span>
                </NextLink>
              </nav>
            </div>

            {/* Resources Column */}
            <div className="flex flex-col">
              <h3 className="text-muted-foreground mb-3 text-base sm:text-lg lg:text-sm font-semibold">
                Resources
              </h3>
              <nav className="flex flex-col gap-2">
                <NextLink
                  href="/docs/get-started/overview"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Documentation
                </NextLink>
                <NextLink
                  href="/docs/api/overview"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  API Reference
                </NextLink>
                <NextLink
                  href="/docs/get-started/quickstart"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Getting Started
                </NextLink>
                <NextLink
                  href="/blog"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Blog
                </NextLink>
                <NextLink
                  href="/docs/examples"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Examples
                </NextLink>
                <NextLink
                  href="/docs/guides/mcp-integration"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  MCP Integration
                </NextLink>
              </nav>
            </div>

            {/* Developers Column */}
            <div className="flex flex-col">
              <h3 className="text-muted-foreground mb-3 text-base sm:text-lg lg:text-sm font-semibold">
                Developers
              </h3>
              <nav className="flex flex-col gap-2">
                <NextLink
                  href="/docs/api/sdks"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  SDKs & Tools
                </NextLink>
                <NextLink
                  href="/docs/api/authentication"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Authentication
                </NextLink>
                <NextLink
                  href="/docs/api/errors"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Error Reference
                </NextLink>
                <NextLink
                  href={siteConfig.links.github.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200 inline-flex items-center gap-1"
                >
                  GitHub
                  <span className="text-xs">↗</span>
                </NextLink>
                <NextLink
                  href={siteConfig.links.discord.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200 inline-flex items-center gap-1"
                >
                  Discord
                  <span className="text-xs">↗</span>
                </NextLink>
              </nav>
            </div>
          </div>

          {/* Company and Legal Links - Additional Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-8 lg:mt-12">
            {/* Company Column */}
            <div className="flex flex-col">
              <h3 className="text-muted-foreground mb-3 text-base sm:text-lg lg:text-sm font-semibold">
                Company
              </h3>
              <nav className="flex flex-col gap-2">
                <NextLink
                  href="/legal/terms"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Terms of Service
                </NextLink>
                <NextLink
                  href="/legal/privacy"
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Privacy Policy
                </NextLink>
                <NextLink
                  href={`mailto:${emailConfig.hello}`}
                  className="text-foreground hover:text-muted-foreground text-sm lg:text-base font-medium transition-colors duration-200"
                >
                  Contact Us
                </NextLink>
              </nav>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 - Contact */}
      <section className="relative py-6 sm:py-8">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Contact Section */}
          <div className="flex flex-col">
            <h3 className="text-foreground mb-2 text-base sm:text-lg font-semibold">
              Have questions or want to chat?
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-foreground text-sm sm:text-base lg:text-lg font-medium">
                Drop us a line at →
              </span>
              <NextLink
                href={`mailto:${emailConfig.hello}`}
                className="text-primary hover:text-primary/80 text-sm sm:text-base lg:text-lg font-medium transition-colors duration-200 hover:underline break-all"
              >
                {emailConfig.hello}
              </NextLink>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 - Copyright and Social */}
      <section className="relative py-6 sm:py-8 border-t border-border/10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Mobile/Tablet: Stack vertically, Desktop: 3-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Social Links - First 2 columns */}
            <div className="flex items-center gap-4 sm:gap-6 lg:col-span-2">
              <NextLink
                target="_blank"
                href={siteConfig.links.github.href}
                aria-label="GitHub"
                className="group transition-all duration-300 hover:scale-110"
              >
                <Icons.gitHub className="text-muted-foreground group-hover:text-foreground size-4 transition-colors duration-300" />
              </NextLink>
              <NextLink
                target="_blank"
                href={siteConfig.links.discord.href}
                aria-label="Discord"
                className="group transition-all duration-300 hover:scale-110"
              >
                <Icons.discord className="text-muted-foreground group-hover:text-foreground size-4 transition-colors duration-300" />
              </NextLink>
              <NextLink
                target="_blank"
                href={siteConfig.links.twitter.href}
                aria-label="Twitter"
                className="group transition-all duration-300 hover:scale-110"
              >
                <Icons.twitter className="text-muted-foreground group-hover:text-foreground size-3 transition-colors duration-300" />
              </NextLink>
            </div>

            {/* Copyright and Additional Info - Last column */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 lg:gap-8">
              {/* Copyright */}
              <div className="flex items-center">
                <span className="group text-muted-foreground relative cursor-default text-xs sm:text-sm">
                  <span className="group-hover:text-foreground relative inline-block transition-all duration-300 group-hover:-translate-y-1">
                    {siteConfig.name}
                  </span>
                  <span className="group-hover:text-muted-foreground/60 relative mx-1 inline-block transition-all duration-300">
                    Inc.
                  </span>
                  <span className="group-hover:text-muted-foreground/60 relative inline-block transition-all duration-300">
                    ©
                  </span>
                  <span className="group-hover:text-foreground relative ml-1 inline-block transition-all duration-300 group-hover:-translate-y-1">
                    {new Date().getFullYear()}
                  </span>
                  <span className="from-primary/40 via-primary to-primary/40 absolute bottom-0 left-0 h-[1px] w-0 bg-gradient-to-r transition-all duration-500 group-hover:w-full" />
                </span>
              </div>

              {/* Additional Info */}
              <div className="hidden sm:block">
                <p className="text-muted-foreground text-xs sm:text-sm">
                  All rights reserved
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </footer>
  );
}
