import type { Metadata, Viewport } from "next";

import "@repo/ui/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { Toaster } from "@repo/ui/components/ui/toaster";
import { cn } from "@repo/ui/lib/utils";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";

import { RequestIdProvider } from "~/components/request-id-refresher";
import { siteConfig } from "~/config/site";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  metadataBase: new URL(siteConfig.url),
  description: siteConfig.description,
  keywords: ["Lightfast", "AI", "Design", "WebGL", "Blender"],
  authors: [
    {
      name: siteConfig.name,
      url: siteConfig.url,
    },
  ],
  creator: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: siteConfig.links.twitter.href,
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
  applicationName: siteConfig.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name,
  },
  formatDetection: {
    telephone: false,
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
    <ClerkProvider waitlistUrl="/">
      <html lang="en" suppressHydrationWarning>
        <head />
        <body
          className={cn(
            "dark min-h-screen bg-background font-sans antialiased",
            GeistSans.variable,
            GeistMono.variable,
          )}
        >
          <div className="relative flex min-h-screen flex-col bg-background">
            {children}
          </div>
          <Toaster />
          <VercelAnalytics />
          <SpeedInsights />
          <RequestIdProvider />
        </body>
      </html>
    </ClerkProvider>
  );
}
