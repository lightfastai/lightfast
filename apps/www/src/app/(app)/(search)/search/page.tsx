import type { Metadata } from "next";
import { SearchNavbar } from "~/components/search-navbar";
import { SearchInterface } from "~/components/search-interface";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Search - AI Workflow Automation Platform",
  description:
    "Search Lightfast documentation, guides, and resources for AI workflow automation.",
  openGraph: {
    title: "Search - AI Workflow Automation Platform",
    description:
      "Search Lightfast documentation, guides, and resources for AI workflow automation.",
    url: "https://lightfast.ai/search",
    type: "website",
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
});

export default function SearchPage() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Navbar with Menu */}
      <SearchNavbar />

      {/* Main Content - Top Aligned */}
      <div className="flex-1 overflow-y-auto px-4 pt-32">
        <SearchInterface />
      </div>
    </div>
  );
}
