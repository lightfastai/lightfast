import "fumadocs-ui/style.css";
import "./globals.css";
import { docsMetadata, siteConfig } from "@/src/lib/site-config";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { RootProvider } from "fumadocs-ui/provider";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createMetadata } from "@vendor/seo/metadata";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html className={fonts} lang="en" suppressHydrationWarning>
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
  description: siteConfig.description,
  image: siteConfig.ogImage,
  metadataBase: new URL(siteConfig.url),
  keywords: [...docsMetadata.keywords],
  authors: [...docsMetadata.authors],
  creator: docsMetadata.creator,
  publisher: docsMetadata.creator,
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
    canonical: siteConfig.url,
  },
  openGraph: {
    title: "Lightfast Docs – Documentation for Neural Memory for Teams",
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "Lightfast Documentation",
        type: "image/jpeg",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Docs – Documentation for Neural Memory for Teams",
    description: siteConfig.description,
    site: "@lightfastai",
    creator: "@lightfastai",
    images: [siteConfig.ogImage],
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
