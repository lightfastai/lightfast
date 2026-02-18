import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { exposureTrial } from "~/lib/fonts";
import { SearchDemo } from "~/components/search-demo";

const secondaryFeatures = [
  {
    title: "Contents",
    description: "Get full documents, metadata, and relationships.",
    exampleTitle: "PR #842 · metadata",
  },
  {
    title: "Similar",
    description: "Find related content based on meaning.",
    exampleTitle: "3 similar results",
  },
  {
    title: "Answer",
    description: "Get answers with citations from your knowledge base.",
    exampleTitle: "Answer · 4 sources",
  },
];

export function FeatureVisualsTabs() {
  return (
    <div className="w-full">
      {/* Hero header */}
      <div className="mb-32">
        <h2
          className={`text-3xl sm:text-4xl md:text-5xl font-light leading-[1.1] tracking-[-0.02em] text-foreground ${exposureTrial.className}`}
        >
          One API for all team data
        </h2>
        <p className="mt-4 text-muted-foreground text-lg">
          A full suite of functionality across 4 endpoints.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Button asChild size="lg" className="rounded-full">
            <Link href="/early-access">Join Early Access</Link>
          </Button>
          <Link
            href="/docs/api"
            className="group inline-flex items-center text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
          >
            <span>API documentation</span>
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Search section header */}
      <div className="mb-8">
        <h3
          className={`text-2xl sm:text-3xl font-light leading-[1.2] tracking-[-0.02em] text-foreground ${exposureTrial.className}`}
        >
          Search
        </h3>
        <p className="mt-2 text-muted-foreground">
          Search and rank results with optional rationale and highlights.
        </p>
      </div>

      {/* Main layout: Search visual left, feature cards right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main search visual - takes 2 cols */}
        <div className="lg:col-span-2">
          <div className="aspect-[16/9] w-full overflow-hidden rounded-sm relative">
            {/* Background image */}
            <Image
              src="/images/nascent_remix.webp"
              alt="Abstract gradient background"
              fill
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="object-cover"
              priority
            />
            {/* Content overlay */}
            <div className="absolute inset-0 flex items-start justify-center p-8 pt-12">
              <div className="w-full max-w-2xl aspect-[16/9] rounded-sm overflow-hidden">
                <SearchDemo />
              </div>
            </div>
          </div>
        </div>

        {/* Secondary feature cards - stacked on right */}
        <div className="flex flex-col gap-6">
          {secondaryFeatures.map((feature) => (
            <div key={feature.title} className="flex gap-4 items-center">
              {/* Mini visual with dither background */}
              <div className="w-32 aspect-square shrink-0 overflow-hidden rounded-sm relative">
                {/* Background image */}
                <Image
                  src="/images/nascent_remix.webp"
                  alt="Abstract gradient background"
                  fill
                  sizes="128px"
                  className="object-cover"
                />
                {/* Mini card overlay */}
                <div className="absolute inset-0 flex items-end justify-start p-2">
                  <div className="bg-background rounded-xs p-2 w-full shadow-sm">
                    <div className="text-xs font-medium text-foreground truncate">
                      {feature.exampleTitle}
                    </div>
                    <div className="mt-1 space-y-1">
                      <div className="h-1.5 bg-muted rounded-full w-full" />
                      <div className="h-1.5 bg-muted rounded-full w-3/4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Text */}
              <div className="flex flex-col gap-1">
                <h3
                  className={`text-2xl font-light text-foreground ${exposureTrial.className}`}
                >
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground max-w-[200px]">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="mt-8 pb-32" />
    </div>
  );
}
