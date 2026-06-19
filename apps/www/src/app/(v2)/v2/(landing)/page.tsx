import type {
  GraphContext,
  Organization,
  SoftwareApplication,
  WebSite,
} from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";

import { LandingExperience } from "./_components/landing-experience";

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
    canonical: "https://lightfast.ai/v2",
  },
  openGraph: {
    title: "Lightfast - A Git Forge for the Agentic Era",
    description:
      "Infrastructure for code moving faster than existing systems were built to handle.",
    url: "https://lightfast.ai/v2",
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

export const revalidate = 3600;

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
    "@id": "https://lightfast.ai/v2#website",
    url: "https://lightfast.ai/v2",
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
      <section className="sr-only" aria-label="Lightfast answer summary">
        <h1>What is Lightfast?</h1>
        <p>
          Lightfast is the operating layer between AI agents, apps, and teams.
          It helps teams observe workspace events, preserve durable memory,
          review long-running agent work, and act across tools with
          source-cited context.
        </p>
        <h2>Who is Lightfast for?</h2>
        <p>
          Lightfast is for engineering teams, founders, and agent builders who
          need AI workflows to survive handoffs, retries, reviews, and
          production changes.
        </p>
      </section>
      <LandingExperience />
    </>
  );
}
