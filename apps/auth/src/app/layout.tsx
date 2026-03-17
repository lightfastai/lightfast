import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { Toaster } from "@repo/ui/components/ui/sonner";
import { fonts as geistFonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";
import { ClerkProvider } from "@vendor/clerk/client";
import { createMetadata } from "@vendor/seo/metadata";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { env } from "~/env";
import { ppNeueMontreal } from "~/lib/fonts";
import { consoleUrl } from "~/lib/related-projects";
import { SentryUserIdentification } from "./_components/sentry-user-identification";

export const metadata: Metadata = createMetadata({
  title: "Lightfast Auth",
  description: "Authentication portal for Lightfast platform",
  metadataBase: new URL("https://lightfast.ai"),
  applicationName: "Lightfast Auth",
  authors: [
    {
      name: "Lightfast",
      url: "https://lightfast.ai",
    },
  ],
  creator: "Lightfast",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://lightfast.ai",
    title: "Lightfast Auth",
    description: "Authentication portal for Lightfast platform",
    siteName: "Lightfast Auth",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Auth",
    description: "Authentication portal for Lightfast platform",
  },
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lightfast Auth",
  },
  formatDetection: {
    telephone: false,
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
  return (
    <html
      className={cn(geistFonts, ppNeueMontreal.variable)}
      lang="en"
      suppressHydrationWarning
    >
      <head />
      <body
        className={cn("dark min-h-screen bg-background font-sans antialiased")}
      >
        <ClerkProvider
          publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
          signInFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
          signInUrl="/sign-in"
          signUpFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
          signUpUrl="/sign-up"
          taskUrls={{
            "choose-organization": `${consoleUrl}/account/teams/new`,
          }}
          waitlistUrl="/early-access"
        >
          <SentryUserIdentification />
          <NuqsAdapter>{children}</NuqsAdapter>
          <Toaster position="bottom-right" />
          <VercelAnalytics />
          <SpeedInsights />
        </ClerkProvider>
      </body>
    </html>
  );
}
