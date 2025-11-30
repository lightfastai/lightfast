import { exposureTrial } from "~/lib/fonts";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowRight } from "lucide-react";
import { VisualShowcase } from "~/components/visual-showcase";
import { SearchDemo } from "~/components/search-demo";
import { IntegrationShowcase } from "~/components/integration-showcase";
import { PlatformAccessCards } from "~/components/platform-access-cards";
import { ChangelogPreview } from "~/components/changelog-preview";
import { FAQSection } from "~/components/faq-section";
import { WaitlistCTA } from "~/components/waitlist-cta";

export default function HomePage() {
  return (
    <>
      <div className="mt-6 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
        {/* Hero Section - centered content */}
        <div className="max-w-7xl mx-auto grid grid-cols-12">
          <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
            <section className="flex w-full flex-col items-center text-center">
              {/* Small label */}
              {/* <div className="mb-8 opacity-80">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Memory built for teams
                </p>
              </div>
              /*}

              {/* Heading */}
              <h1
                className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] px-4 text-balance ${exposureTrial.className}`}
              >
                Memory built for teams
                {/* Search everything your team knows.
                <br /> Get answers with sources. */}
              </h1>

              {/* Description */}
              <div className="mt-4 px-4 w-full">
                <p className="text-base text-muted-foreground whitespace-nowrap md:whitespace-normal lg:whitespace-nowrap">
                  Search everything your team knows. Get answers with sources.
                </p>
              </div>

              {/* CTA - centered */}
              <div className="mt-8 flex flex-col justify-center gap-8 sm:flex-row">
                <Button asChild size="lg" className="rounded-full">
                  <Link href="/early-access" className="group">
                    <span>Join Early Access</span>
                  </Link>
                </Button>
                <Link
                  href="/docs/get-started/overview"
                  className="group inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-foreground/80"
                >
                  <span>Learn more about Lightfast</span>
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </section>
          </div>
        </div>

        {/* Platform Access Cards */}
        <PlatformAccessCards />

        {/* Demo Section - Search Visual */}
        {/* <div className="max-w-6xl px-4 mx-auto w-full py-10">
          <VisualShowcase>
            <SearchDemo />
          </VisualShowcase>
        </div> */}

        {/* Integration Showcase */}
        <div className="max-w-6xl mx-auto w-full px-4 py-10">
          <IntegrationShowcase />
        </div>

        {/* FAQ Section */}
        <div className="max-w-6xl mx-auto w-full px-4 py-10">
          <FAQSection />
        </div>

        {/* Changelog Preview */}
        <div className="max-w-6xl mx-auto w-full px-4">
          <ChangelogPreview />
        </div>
      </div>

      {/* Waitlist CTA - Outside of padding container */}
      <WaitlistCTA />
    </>
  );
}
