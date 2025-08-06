import type { Metadata, Viewport } from "next";

import "@repo/ui/globals.css";

import { siteConfig } from "@repo/lightfast-config";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { getClerkConfig } from "@repo/url-utils";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";
import { env } from "~/env";
import { QueryProvider } from "~/providers/query-provider";

export const metadata: Metadata = {
  title: {
    default: "Lightfast Playground",
    template: `%s - Lightfast Playground`,
  },
  metadataBase: new URL(siteConfig.url),
  description: "Interactive AI agent playground",
  keywords: [
    "Lightfast",
    "Playground",
    "AI",
    "Agents",
  ],
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
    title: "Lightfast Playground",
    description: "Interactive AI agent playground",
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "Lightfast Playground",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Playground",
    description: "Interactive AI agent playground",
    images: [siteConfig.ogImage],
  },
  icons: {
    icon: "/playground/favicon.ico",
    shortcut: "/playground/favicon-16x16.png",
    apple: "/playground/apple-touch-icon.png",
    other: [
      {
        rel: "icon",
        url: "/playground/favicon-32x32.png",
      },
      {
        rel: "icon",
        url: "/playground/android-chrome-192x192.png",
      },
      {
        rel: "icon",
        url: "/playground/android-chrome-512x512.png",
      },
    ],
  },
  manifest: "/playground/manifest.webmanifest",
  applicationName: "Lightfast Playground",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lightfast Playground",
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
  const clerkConfig = getClerkConfig("playground");

  return (
    <ClerkProvider
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      {...clerkConfig}
      appearance={{
        variables: {
          colorPrimary: "#3b82f6",
          colorBackground: "#0a0a0a",
          colorInputBackground: "#18181b",
          colorInputText: "#fafafa",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head />
        <body className={cn("bg-background dark min-h-screen", fonts)}>
          <QueryProvider>
            {children}
            <Toaster />
            <VercelAnalytics />
            <SpeedInsights />
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}