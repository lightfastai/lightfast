import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { siteConfig } from "@repo/site-config";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { SearchBackground } from "~/components/search/search-background";
import {
  PrefetchCrossZoneLinks,
  PrefetchCrossZoneLinksProvider,
} from "@vercel/microfrontends/next/client";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Lightfast – Neural Memory for Teams",
  description:
    "Search your team's neural memory across code, docs, decisions, and more — always with sources.",
  metadataBase: new URL(siteConfig.url),
  robots: {
    index: true,
    follow: true,
  },
});

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen dark bg-background", fonts)}>
        <PrefetchCrossZoneLinksProvider>
          <div className="relative isolate min-h-screen">
            {/* Background image + effects (layered below content) */}
            <SearchBackground />
            <div className="relative z-10">{children}</div>
          </div>
        </PrefetchCrossZoneLinksProvider>
        <PrefetchCrossZoneLinks />
      </body>
    </html>
  );
}
