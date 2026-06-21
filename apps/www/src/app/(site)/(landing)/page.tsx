import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logo } from "@repo/ui-v2/components/brand/logo";
import type {
  GraphContext,
  Organization,
  SoftwareApplication,
  WebSite,
} from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "A Git Forge for the Agentic Era",
  description:
    "Lightfast is building infrastructure for code moving faster than existing systems were built to handle.",
  keywords: [
    "AI developer tools",
    "agentic coding",
    "git forge",
    "software agents",
    "AI infrastructure",
    "developer infrastructure",
    "Lightfast",
  ],
  authors: [{ name: "Lightfast", url: "https://lightfast.ai" }],
  creator: "Lightfast",
  publisher: "Lightfast",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://lightfast.ai",
  },
  openGraph: {
    title: "Lightfast - A Git Forge for the Agentic Era",
    description:
      "Infrastructure for code moving faster than existing systems were built to handle.",
    url: "https://lightfast.ai",
    siteName: "Lightfast",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast - A Git Forge for the Agentic Era",
    description:
      "Infrastructure for code moving faster than existing systems were built to handle.",
    site: "@lightfastai",
    creator: "@lightfastai",
  },
  category: "Technology",
};

export default function HomePage() {
  const organizationEntity: Organization = {
    "@type": "Organization",
    "@id": "https://lightfast.ai/#organization",
    name: "Lightfast",
    url: "https://lightfast.ai",
    logo: {
      "@type": "ImageObject",
      url: "https://lightfast.ai/android-chrome-512x512.png",
    },
    sameAs: [
      "https://twitter.com/lightfastai",
      "https://github.com/lightfastai",
      "https://www.linkedin.com/company/lightfastai",
    ],
    description:
      "Lightfast is building infrastructure for code moving faster than existing systems were built to handle.",
  };

  const websiteEntity: WebSite = {
    "@type": "WebSite",
    "@id": "https://lightfast.ai/#website",
    url: "https://lightfast.ai",
    name: "Lightfast",
    description: "A git forge for the agentic era.",
    publisher: {
      "@id": "https://lightfast.ai/#organization",
    },
  };

  const softwareEntity: SoftwareApplication = {
    "@type": "SoftwareApplication",
    "@id": "https://lightfast.ai/#software",
    name: "Lightfast",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      url: "https://lightfast.ai/sign-up",
    },
    description:
      "A git forge for the agentic era, designed for code moving faster than existing infrastructure was built to handle.",
    featureList: [
      "Agentic software development infrastructure",
      "Developer workflows for AI-assisted code",
      "Version control workflows for modern software teams",
    ],
  };

  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [organizationEntity, websiteEntity, softwareEntity],
  };

  return (
    <>
      <JsonLd code={structuredData} />
      <section aria-label="Lightfast answer summary" className="sr-only">
        <h1>What is Lightfast?</h1>
        <p>
          Lightfast is the operating layer between AI agents, apps, and teams.
          It helps teams observe workspace events, preserve durable memory,
          review long-running agent work, and act across tools with source-cited
          context.
        </p>
        <h2>Who is Lightfast for?</h2>
        <p>
          Lightfast is for engineering teams, founders, and agent builders who
          need AI workflows to survive handoffs, retries, reviews, and
          production changes.
        </p>
      </section>
      <main className="relative min-h-svh overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        <picture className="absolute inset-0 z-0">
          <source
            srcSet="/images/landing-halftone-bg-q40.avif"
            type="image/avif"
          />
          <source
            srcSet="/images/landing-halftone-bg-q40.webp"
            type="image/webp"
          />
          <img
            alt=""
            className="h-full w-full rotate-180 object-cover"
            decoding="async"
            fetchPriority="high"
            height={900}
            src="/images/landing-halftone-bg-q40.webp"
            width={1440}
          />
        </picture>
        <div className="absolute inset-0 z-[1] bg-background/40" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 text-foreground"
        >
          <div className="absolute inset-x-0 top-20 h-px bg-foreground/10 sm:top-44" />
          <div className="absolute top-0 bottom-0 left-1/4 w-px bg-foreground/10" />
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            fill="none"
            preserveAspectRatio="none"
            viewBox="0 0 1440 900"
          >
            <path
              d="M175 -8 C128 206 116 548 275 748 C432 945 806 833 1448 368"
              stroke="currentColor"
              strokeOpacity={0.8}
              strokeWidth="1"
            />
            <path
              d="M1160 -2 L1446 280"
              stroke="currentColor"
              strokeDasharray="6 8"
              strokeOpacity={0.8}
              strokeWidth="1"
            />
          </svg>
        </div>

        <section className="relative z-10 grid min-h-svh w-full grid-cols-2 gap-4 p-6 pt-28 sm:p-10 sm:pt-52 md:grid-cols-4 lg:gap-6">
          <div className="col-span-2 row-start-1 flex w-full flex-col items-start self-start text-left md:col-span-2 lg:col-start-2">
            <Link
              aria-label="Lightfast home"
              className="inline-flex h-10 items-center gap-2 text-foreground transition-colors hover:text-muted-foreground"
              href="/"
            >
              <Logo className="text-current" size="sm" />
            </Link>

            <h1 className="mt-10 w-full max-w-2xl text-balance pr-10 font-medium font-title text-5xl max-sm:pr-0 sm:text-5xl">
              A git forge for the agentic era
            </h1>

            <p className="mt-4 max-w-xl text-base text-foreground/80 leading-7 tracking-normal">
              Code is moving faster than any infrastructure was built to handle.
              <br />
              Origin was designed for this moment.
            </p>

            <form
              action="/sign-up"
              className="relative mt-8 w-full max-w-xl text-left"
              method="get"
            >
              <label
                className="mb-2 block text-base text-foreground leading-6 tracking-normal"
                htmlFor="landing-email"
              >
                Join the waitlist
              </label>

              <div className="relative flex items-center">
                <input
                  className="m-0 w-full cursor-pointer border border-border bg-muted p-3 pr-14 text-base text-foreground leading-6 outline-none transition-colors placeholder:text-foreground hover:border-muted-foreground/30 focus:border-ring"
                  id="landing-email"
                  inputMode="email"
                  name="email"
                  placeholder="Enter your work email"
                  required
                  type="email"
                />
                <button
                  aria-label="Join the waitlist"
                  className="absolute inset-y-0 right-0 flex h-full cursor-pointer items-center gap-2 bg-transparent p-3 text-xs leading-tight transition-colors hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:outline-none disabled:pointer-events-none disabled:text-muted-foreground"
                  type="submit"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="size-4"
                    icon={ArrowRight01Icon}
                    strokeWidth={1.8}
                  />
                </button>
              </div>
              <p className="mt-3 text-muted-foreground text-xs">
                By joining, you agree to receive early access updates. See our{" "}
                <Link
                  className="underline underline-offset-2 transition-colors hover:text-foreground"
                  href="/legal/privacy"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
