import { exposureTrial } from "~/lib/fonts";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowRight } from "lucide-react";
import { VisualShowcase } from "~/components/visual-showcase";
import { SearchDemo } from "~/components/search-demo";

export default function HomePage() {
  return (
    <div className="mt-10 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
      {/* Hero Section - centered content */}
      <div className="max-w-7xl mx-auto grid grid-cols-12">
        <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
          <section className="flex w-full flex-col items-center text-center">
            {/* Small label */}
            <div className="mb-8 opacity-80">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Memory built for teams
              </p>
            </div>

            {/* Heading */}
            <h1
              className={`text-3xl sm:text-4xl md:text-5xl font-light leading-[1.1] tracking-[-0.02em] px-4 text-balance ${exposureTrial.className}`}
            >
              Search everything your team knows.
              <br /> Get answers with sources.
            </h1>

            {/* Description */}
            <div className="mt-8 px-4">
              <p className="text-base text-muted-foreground">
                Search by meaning, not keywords. Every answer shows its source.
                Available for everyone.
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

      {/* Demo Section - Search Visual */}
      <div className="max-w-7xl mx-auto w-full">
        <VisualShowcase>
          <SearchDemo />
        </VisualShowcase>
      </div>
    </div>
  );
}
