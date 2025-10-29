import "fumadocs-ui/style.css";
import "./globals.css";
import { docsMetadata, siteConfig } from "@/src/lib/site-config";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { Providers } from "@/src/components/providers";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createMetadata } from "@vendor/seo/metadata";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn("bg-background min-h-screen dark", fonts)}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

export const metadata: Metadata = createMetadata({
  title: "Lightfast – Neural Memory for Teams",
  description: siteConfig.description,
  image: siteConfig.ogImage,
  metadataBase: new URL(siteConfig.url),
  authors: [...docsMetadata.authors],
  creator: docsMetadata.creator,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: `${siteConfig.name} – Neural Memory for Teams`,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} – Neural Memory for Teams`,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@lightfastai",
  },
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
