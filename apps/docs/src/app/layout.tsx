import "fumadocs-ui/style.css";
import "@/src/styles/globals.css";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { neueMontreal, exposureTrial } from "@/src/lib/fonts";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createMetadata } from "@vendor/seo/metadata";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html className={cn(fonts, neueMontreal.variable, exposureTrial.variable)} lang="en" suppressHydrationWarning>
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
  title: "Lightfast Docs – Documentation for Neural Memory for Teams",
  description: "Documentation for Lightfast neural memory — Learn how to integrate the memory layer for software teams via a simple REST API and MCP tools. Build search by meaning with sources.",
  image: "https://lightfast.ai/og.jpg",
  metadataBase: new URL("https://lightfast.ai/docs"),
  keywords: [
    "Lightfast documentation",
    "memory layer",
    "memory layer for software teams",
    "software team memory",
    "engineering knowledge search",
    "neural memory docs",
    "semantic search",
    "semantic search docs",
    "answers with sources",
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
    title: "Lightfast Docs – Documentation for Neural Memory for Teams",
    description: "Documentation for Lightfast neural memory — Learn how to integrate the memory layer for software teams via a simple REST API and MCP tools. Build search by meaning with sources.",
    url: "https://lightfast.ai/docs",
    siteName: "Lightfast Docs",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://lightfast.ai/og.jpg",
        width: 1200,
        height: 630,
        alt: "Lightfast Documentation",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Docs – Documentation for Neural Memory for Teams",
    description: "Documentation for Lightfast neural memory — Learn how to integrate the memory layer for software teams via a simple REST API and MCP tools. Build search by meaning with sources.",
    site: "@lightfastai",
    creator: "@lightfastai",
    images: ["https://lightfast.ai/og.jpg"],
  },
  category: "Technology",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "icon",
        url: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        url: "/android-chrome-192x192.png",
      },
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
      },
    ],
  },
});
