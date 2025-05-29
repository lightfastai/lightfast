import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { emailConfig, siteConfig } from "@repo/lightfast-config";
import { Icons } from "@repo/ui/components/icons";

export function SiteFooter() {
  return (
    <footer className="bg-background relative h-screen w-full text-white">
      {/* Section 1 - Logo and Services/Company (40vh) */}
      <section className="flex h-[40vh] items-center">
        <div className="mx-auto w-full max-w-7xl px-8">
          <div className="flex items-start justify-between">
            {/* Left - Logo (fixed width for alignment) */}
            <div className="w-1/2 flex-shrink-0">
              <Icons.logo className="text-foreground w-32" />
            </div>

            {/* Right - Services and Company (fixed width for alignment) */}
            <div className="w-1/2">
              <div className="flex gap-24">
                {/* Services Column */}
                <div className="flex flex-col">
                  <h3 className="text-muted-foreground mb-3 text-xl font-semibold">
                    Services
                  </h3>
                  <nav className="flex flex-col gap-3">
                    <Link
                      href="#"
                      className="text-foreground hover:text-muted-foreground text-2xl font-bold transition-colors duration-200"
                    >
                      Copilot for Creatives
                    </Link>
                    <Link
                      href="#"
                      className="text-foreground hover:text-muted-foreground text-2xl font-bold transition-colors duration-200"
                    >
                      Workflow Automation
                    </Link>
                    <Link
                      href="#"
                      className="text-foreground hover:text-muted-foreground text-2xl font-bold transition-colors duration-200"
                    >
                      AI-powered Design
                    </Link>
                  </nav>
                </div>

                {/* Company Column */}
                <div className="flex flex-col">
                  <h3 className="text-muted-foreground mb-3 text-xl font-semibold">
                    Links
                  </h3>
                  <nav className="flex flex-col gap-3">
                    <Link
                      href="/legal/terms"
                      className="text-foreground hover:text-muted-foreground text-2xl font-bold transition-colors duration-200"
                    >
                      Terms & Conditions
                    </Link>
                    <Link
                      href="/legal/privacy"
                      className="text-foreground hover:text-muted-foreground text-2xl font-bold transition-colors duration-200"
                    >
                      Privacy Policy
                    </Link>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 - Contact and Early Access (30vh) */}
      <section className="flex h-[30vh] items-center">
        <div className="mx-auto w-full max-w-7xl px-8">
          <div className="flex items-start">
            {/* Left - Contact (fixed width for alignment) */}
            <div className="flex w-1/2 flex-col">
              <h3 className="text-foreground mb-1 text-lg font-semibold">
                Have questions or want to chat?
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-foreground text-lg font-semibold">
                  Drop us a line at &rarr;
                </span>
                <Link
                  href={`mailto:${emailConfig.hello}`}
                  className="text-primary hover:text-primary/80 text-lg font-medium transition-colors duration-200 hover:underline"
                >
                  {emailConfig.hello}
                </Link>
              </div>
            </div>

            {/* Right - Early Access (fixed width for alignment) */}
            <div className="w-1/2 max-w-xs">
              <div className="flex flex-col">
                <h3 className="text-foreground text-md mb-4 font-semibold">
                  Stay in the loop and be the first to know what's coming next
                  for Lightfast, get industry expert analysis, and much more.
                </h3>
                <div className="flex flex-col gap-2">
                  <Link
                    href="#"
                    className="text-primary hover:text-primary/80 inline-flex w-fit items-center gap-2 text-sm font-medium transition-colors duration-200 hover:underline"
                  >
                    Subscribe to Lightfast
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 - Copyright and Social (30vh) */}
      <section className="flex h-[30vh] items-center">
        <div className="mx-auto w-full max-w-7xl px-8">
          <div className="flex items-center justify-between">
            {/* Left - Social Links (fixed width for alignment) */}
            <div className="flex w-1/2 items-center gap-6">
              <Link
                target="_blank"
                href={siteConfig.links.github.href}
                aria-label="GitHub"
                className="group transition-all duration-300 hover:scale-110"
              >
                <Icons.gitHub className="text-muted-foreground group-hover:text-foreground size-6 transition-colors duration-300" />
              </Link>
              <Link
                target="_blank"
                href={siteConfig.links.discord.href}
                aria-label="Discord"
                className="group transition-all duration-300 hover:scale-110"
              >
                <Icons.discord className="text-muted-foreground group-hover:text-foreground size-6 transition-colors duration-300" />
              </Link>
              <Link
                target="_blank"
                href={siteConfig.links.twitter.href}
                aria-label="Twitter"
                className="group transition-all duration-300 hover:scale-110"
              >
                <Icons.twitter className="text-muted-foreground group-hover:text-foreground size-5 transition-colors duration-300" />
              </Link>
            </div>

            {/* Right - Copyright and Additional Info (fixed width for alignment) */}
            <div className="w-1/2">
              <div className="flex items-center gap-8 font-mono">
                {/* Copyright */}
                <div className="flex items-center">
                  <span className="group text-muted-foreground relative cursor-default text-sm">
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
                <div>
                  <p className="text-muted-foreground text-xs">
                    All rights reserved
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </footer>
  );
}
