import type { Metadata } from "next";
import { SearchInput } from "~/components/search/search-input";
import { LightfastImageViewer } from "~/components/search/lightfast-image-viewer";
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
    <>
      {/* Search Section */}
      <div className="pb-16">
        <div className="relative max-w-5xl mx-auto">
          <div className="space-y-12">
            {/* Header */}
            <div className="text-center space-y-4">
              <h1
                className={`text-4xl font-light tracking-[-0.7] text-foreground ${exposureTrial.className}`}
              >
                Search Lightfast
              </h1>
              <p className="text-sm max-w-xs text-muted-foreground mx-auto">
                Find anything in your code, company knowledge, or documentation
              </p>
            </div>

            {/* Search Input */}
            <SearchInput />

            {/* Helper Text */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Try searching for features, integrations, or documentation
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Image Viewer Section */}
      <div className="py-16">
        <div className="w-full">
          <div className="h-[900px] w-full">
            <LightfastImageViewer src="/images/playground-placeholder-1.webp" />
          </div>
        </div>
      </div>
    </>
  );
}
