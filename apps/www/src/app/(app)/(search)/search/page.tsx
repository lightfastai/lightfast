import type { Metadata } from "next";
import { SearchInterface } from "~/app/(app)/_components/search-interface";
import { SearchNavbar } from "~/app/(app)/_components/search-navbar";
import { createMetadata } from "~/lib/content-seo";

export const metadata: Metadata = createMetadata({
  title: "Search – Lightfast",
  description:
    "Search across Lightfast documentation, guides, and resources. Find what you need about the operating layer for agents and apps.",
  openGraph: {
    title: "Search – Lightfast",
    description:
      "Search across Lightfast documentation, guides, and resources. Find what you need about the operating layer for agents and apps.",
    url: "https://lightfast.ai/search",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Search – Lightfast",
    description:
      "Search across Lightfast documentation, guides, and resources.",
  },
  alternates: {
    canonical: "https://lightfast.ai/search",
  },
});

export default function SearchPage() {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Navbar with Menu */}
      <SearchNavbar />

      {/* Main Content - Top Aligned */}
      <div className="flex-1 overflow-y-auto px-4 pt-32">
        <SearchInterface />
      </div>
    </div>
  );
}
