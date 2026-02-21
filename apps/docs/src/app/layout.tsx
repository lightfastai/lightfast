import "fumadocs-ui/style.css";
import "@/src/styles/globals.css";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { neueMontreal, exposurePlus, ppSupplySans } from "@/src/lib/fonts";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createMetadata } from "@vendor/seo/metadata";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html className={cn(fonts, neueMontreal.variable, exposurePlus.variable, ppSupplySans.variable)} lang="en" suppressHydrationWarning>
      <head />
      <body className={cn("bg-background min-h-screen dark")}>
        <RootProvider
          search={{
            enabled: false, // Disable fumadocs search
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}

// Comprehensive metadata following www app pattern with createMetadata
export const metadata: Metadata = createMetadata({
  title: "Lightfast Docs – Surface Decisions Across Your Tools",
  description: "Documentation for Lightfast — Learn how to surface every decision your team makes across your tools via a simple REST API and MCP tools. Searchable, cited, and ready for people and agents.",
  metadataBase: new URL("https://lightfast.ai/docs"),
  keywords: [
    "Lightfast documentation",
    "decision search",
    "decisions across tools",
    "team decisions",
    "engineering knowledge search",
    "cited answers",
    "semantic search",
    "semantic search docs",
    "searchable decisions",
    "developer API",
    "developer API reference",
    "MCP tools",
    "REST API",
    "security best practices",
  ],
  authors: [
    {
      name: "Lightfast",
      url: "https://lightfast.ai",
    },
  ],
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
    canonical: "https://lightfast.ai/docs",
  },
  openGraph: {
    title: "Lightfast Docs – Surface Decisions Across Your Tools",
    description: "Documentation for Lightfast — Learn how to surface every decision your team makes across your tools via a simple REST API and MCP tools. Searchable, cited, and ready for people and agents.",
    url: "https://lightfast.ai/docs",
    siteName: "Lightfast Docs",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Docs – Surface Decisions Across Your Tools",
    description: "Documentation for Lightfast — Learn how to surface every decision your team makes across your tools via a simple REST API and MCP tools. Searchable, cited, and ready for people and agents.",
    site: "@lightfastai",
    creator: "@lightfastai",
  },
  category: "Technology",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "icon", url: "/favicon-32x32.png", sizes: "32x32" },
      { rel: "icon", url: "/android-chrome-192x192.png", sizes: "192x192" },
      { rel: "icon", url: "/android-chrome-512x512.png", sizes: "512x512" },
    ],
  },
});
