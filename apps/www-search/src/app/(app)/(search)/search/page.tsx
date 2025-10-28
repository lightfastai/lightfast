import type { Metadata } from "next";
import { SearchInput } from "~/components/search/search-input";
import { SearchNavbar } from "~/components/search/search-navbar";
import { exposureTrial } from "~/lib/fonts";

export const metadata: Metadata = {
  title: "Search - AI Workflow Automation Platform",
  description:
    "Search Lightfast documentation, guides, and resources for AI workflow automation.",
  openGraph: {
    title: "Search - AI Workflow Automation Platform",
    description:
      "Search Lightfast documentation, guides, and resources for AI workflow automation.",
    url: "https://lightfast.ai/search",
    type: "website",
    images: [
      {
        url: "https://lightfast.ai/og.jpg",
        width: 1200,
        height: 630,
        alt: "AI Workflow Automation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Search - AI Workflow Automation Platform",
    description:
      "Search Lightfast documentation, guides, and resources for AI workflow automation.",
    images: ["https://lightfast.ai/og.jpg"],
  },
  alternates: {
    canonical: "https://lightfast.ai/search",
  },
};

export default function SearchPage() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Navbar with Menu */}
      <SearchNavbar />

      {/* Main Content - Top Aligned */}
      <div className="flex-1 overflow-y-auto px-4 pt-24">
        <div className="w-full max-w-3xl mx-auto space-y-8 pb-12">
          {/* Header */}
          <h1
            className={`text-4xl font-light tracking-[-0.7] text-foreground ${exposureTrial.className}`}
          >
            Search about Lightfast
          </h1>

          {/* Search Input */}
          <SearchInput />
        </div>
      </div>
    </div>
  );
}
