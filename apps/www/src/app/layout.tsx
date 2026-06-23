import "~/styles/styles.css";

import { cn } from "@repo/ui-v2/lib/utils";
import { ThemeProvider } from "@repo/ui-v2/providers/theme-provider";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";
import type { Organization, WithContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import {
  PrefetchCrossZoneLinks,
  PrefetchCrossZoneLinksProvider,
} from "@vercel/microfrontends/next/client";

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { createMetadata } from "~/lib/content-seo";

const geistSans = localFont({
  src: "../../public/fonts/subsets/Geist-Variable-www-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "../../public/fonts/subsets/GeistMono-Variable-www-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

const ppNeueMontreal = localFont({
  src: [
    {
      path: "../../public/fonts/subsets/PPNeueMontreal-Medium-www-latin.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-pp-neue-montreal",
  display: "swap",
});

export const metadata: Metadata = createMetadata({
  title: "Lightfast – The Operating Layer for Agents and Apps",
  description:
    "Lightfast is the operating layer between your agents and apps. Observe what's happening across your tools, remember what happened, and give agents and people a single system to reason and act through.",
  applicationName: "Lightfast",
  metadataBase: new URL("https://lightfast.ai"),
  authors: [
    {
      name: "Lightfast",
      url: "https://lightfast.ai",
    },
  ],
  creator: "Lightfast",
  publisher: "Lightfast",
  category: "Technology",
  classification: "Operating Infrastructure Platform",
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
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://lightfast.ai",
    title: "Lightfast – The Operating Layer for Agents and Apps",
    description:
      "The operating layer between your agents and apps. Observe events, build memory, and act across your entire tool stack.",
    siteName: "Lightfast",
  },
  twitter: {
    card: "summary_large_image",
    site: "@lightfastai",
    creator: "@lightfastai",
    title: "Lightfast – The Operating Layer for Agents and Apps",
    description:
      "The operating layer between your agents and apps. Observe events, build memory, and act across your entire tool stack.",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "icon",
        url: "/favicon-32x32.png",
        sizes: "32x32",
      },
      {
        rel: "icon",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
      },
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
      },
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lightfast",
    startupImage: "/apple-touch-icon.png",
  },
  formatDetection: {
    telephone: false,
  },
  alternates: {
    canonical: "https://lightfast.ai",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
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
  const organizationSchema: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Lightfast",
    url: "https://lightfast.ai",
    logo: "https://lightfast.ai/android-chrome-512x512.png",
    sameAs: [
      "https://x.com/lightfastai",
      "https://github.com/lightfastai",
      "https://discord.gg/YqPDfcar2C",
    ],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Lightfast",
    url: "https://lightfast.ai",
  } as const;

  return (
    <html
      className={cn(
        geistSans.variable,
        geistMono.variable,
        ppNeueMontreal.variable,
        "scrollbar-thin touch-manipulation font-sans antialiased"
      )}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <JsonLd code={organizationSchema} />
        <JsonLd code={websiteSchema} />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
          scriptProps={{ type: "application/x-next-themes" }}
        >
          <PrefetchCrossZoneLinksProvider>
            {children}
            <VercelAnalytics />
            <SpeedInsights />
            <PrefetchCrossZoneLinks />
          </PrefetchCrossZoneLinksProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
