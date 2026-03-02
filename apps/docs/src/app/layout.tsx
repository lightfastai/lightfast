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
  title: "Lightfast Docs – The Operating Layer for Agents and Apps",
  description: "Documentation for Lightfast — Learn how to observe events, build memory, and act across your entire tool stack via a simple REST API and MCP tools.",
  metadataBase: new URL("https://lightfast.ai/docs"),
  keywords: [
    "Lightfast documentation",
    "operating infrastructure",
    "agent infrastructure",
    "event-driven architecture",
    "real-time events",
    "MCP tools",
    "REST API",
    "developer API",
    "developer API reference",
    "semantic search",
    "tool integration",
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
    title: "Lightfast Docs – The Operating Layer for Agents and Apps",
    description: "Documentation for Lightfast — Learn how to observe events, build memory, and act across your entire tool stack via a simple REST API and MCP tools.",
    url: "https://lightfast.ai/docs",
    siteName: "Lightfast Docs",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Docs – The Operating Layer for Agents and Apps",
    description: "Documentation for Lightfast — Learn how to observe events, build memory, and act across your entire tool stack via a simple REST API and MCP tools.",
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
