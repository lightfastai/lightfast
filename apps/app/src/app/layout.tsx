import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { fonts as geistFonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";
import { ClerkProvider } from "@vendor/clerk/client";
import { createMetadata } from "@vendor/seo/metadata";
import {
  PrefetchCrossZoneLinks,
  PrefetchCrossZoneLinksProvider,
} from "@vercel/microfrontends/next/client";
import { env } from "~/env";
import { ppNeueMontreal } from "~/lib/fonts";

export const metadata: Metadata = createMetadata({
  title: "Console",
  description:
    "Build powerful AI workflow orchestration with natural language. Connect AI to any tool via MCP and automate complex workflows without code.",
  metadataBase: new URL("https://lightfast.ai"),
  authors: [{ name: "Lightfast", url: "https://lightfast.ai" }],
  creator: "Lightfast",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://lightfast.ai",
    title: "Console - AI Workflow Orchestration",
    description:
      "Build powerful AI workflow orchestration with natural language. Connect AI to any tool via MCP and automate complex workflows without code.",
    siteName: "Lightfast",
  },
  twitter: {
    card: "summary_large_image",
    title: "Console - AI Workflow Orchestration",
    description:
      "Build powerful AI workflow orchestration with natural language. Connect AI to any tool via MCP and automate complex workflows without code.",
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
      <body className="dark min-h-screen bg-background antialiased">
        <ClerkProvider
          afterSignOutUrl="/sign-in"
          publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
          signInFallbackRedirectUrl="/account/welcome"
          signInUrl="/sign-in"
          signUpFallbackRedirectUrl="/account/welcome"
          signUpUrl="/sign-up"
          waitlistUrl="/early-access"
        >
          <PrefetchCrossZoneLinksProvider>
            {children}
            <VercelAnalytics />
            <SpeedInsights />
            <PrefetchCrossZoneLinks />
          </PrefetchCrossZoneLinksProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
