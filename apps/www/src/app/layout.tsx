import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { siteConfig } from "@repo/site-config";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { ClerkProvider } from "@vendor/clerk/client";
import { PostHogProvider } from "@vendor/analytics/posthog-client";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";
import { createMetadata } from "@vendor/seo/metadata";
import {
  PrefetchCrossZoneLinks,
  PrefetchCrossZoneLinksProvider,
} from "@vercel/microfrontends/next/client";

import { createBaseUrl } from "~/lib/base-url";
import { env } from "~/env";
import { authUrl, consoleUrl } from "~/lib/related-projects";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Organization, WebSite, WithContext } from "@vendor/seo/json-ld";

export const metadata: Metadata = createMetadata({
  title: "Lightfast – The Memory Layer for Software Teams",
  description:
    "Neural memory for teams. Search by meaning with sources. Capture decisions and context across code, docs, and tools.",
  image: siteConfig.ogImage,
  applicationName: "Lightfast Neural Memory",
  metadataBase: new URL(siteConfig.url),
  authors: [
    {
      name: siteConfig.name,
      url: siteConfig.url,
    },
  ],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "Technology",
  classification: "Neural Memory Platform",
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
  verification: {
    google: "PLACEHOLDER_VERIFICATION_CODE",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: "Lightfast – The Memory Layer for Software Teams",
    description:
      "Search by meaning with sources. Capture decisions, context, and ownership across your stack.",
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    site: "@lightfastai",
    creator: "@lightfastai",
    title: "Lightfast – The Memory Layer for Software Teams",
    description:
      "Semantic search with sources. Developer‑first API and MCP tools.",
    images: [siteConfig.ogImage],
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
    canonical: siteConfig.url,
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
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/android-chrome-512x512.png`,
    sameAs: [
      siteConfig.links.twitter.href,
      siteConfig.links.github.href,
      siteConfig.links.discord.href,
    ],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: `${siteConfig.name} – The Memory Layer for Software Teams`,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  } as const;

  return (
    <ClerkProvider
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      // Delegate sign-in/sign-up to auth app
      signInUrl={`${authUrl}/sign-in`}
      signUpUrl={`${authUrl}/sign-up`}
      // After authentication, redirect to console app
      afterSignInUrl={consoleUrl}
      afterSignUpUrl={consoleUrl}
      signInFallbackRedirectUrl={consoleUrl}
      signUpFallbackRedirectUrl={consoleUrl}
      // Multi-step onboarding task URLs
      taskUrls={{
        "choose-organization": `${consoleUrl}/onboarding`,
      }}
    >
      <html className={fonts} lang="en" suppressHydrationWarning>
        <head>
          <JsonLd code={organizationSchema} />
          <JsonLd code={websiteSchema} />
        </head>
        <body className={cn("min-h-screen dark font-sans bg-background")}>
          <PrefetchCrossZoneLinksProvider>
            <PostHogProvider baseUrl={createBaseUrl()}>
              {children}
              <Toaster />
              <VercelAnalytics />
              <SpeedInsights />
            </PostHogProvider>
            <PrefetchCrossZoneLinks />
          </PrefetchCrossZoneLinksProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
