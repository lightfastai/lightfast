import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { siteConfig } from "@repo/site-config";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import {
  PrefetchCrossZoneLinks,
  PrefetchCrossZoneLinksProvider,
} from "@vercel/microfrontends/next/client";

export const metadata: Metadata = {
  title: {
    default: "Search - Lightfast AI Agent Platform",
    template: `%s | Lightfast Search`,
  },
  metadataBase: new URL(siteConfig.url),
  description: "Search Lightfast documentation, code, and company resources.",
  robots: {
    index: true,
    follow: true,
  },
};

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
          {children}
        </PrefetchCrossZoneLinksProvider>
        <PrefetchCrossZoneLinks />
      </body>
    </html>
  );
}
