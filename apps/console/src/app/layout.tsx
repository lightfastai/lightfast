import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { siteConfig } from "@repo/site-config";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@repo/console-trpc/react";
import { createMetadata } from "@vendor/seo/metadata";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { authUrl } from "~/lib/related-projects";

export const metadata: Metadata = createMetadata({
  title: "Console",
  description:
    "Build powerful AI workflow orchestration with natural language. Connect AI to any tool via MCP and automate complex workflows without code.",
  image: siteConfig.ogImage,
  metadataBase: new URL("https://console.lightfast.ai"),
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://console.lightfast.ai",
    title: "Console - AI Workflow Orchestration",
    description:
      "Build powerful AI workflow orchestration with natural language. Connect AI to any tool via MCP and automate complex workflows without code.",
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: "Console - AI Workflow Orchestration",
    description:
      "Build powerful AI workflow orchestration with natural language. Connect AI to any tool via MCP and automate complex workflows without code.",
    images: [siteConfig.ogImage],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
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
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl={`${authUrl}/sign-in`}
      signUpUrl={`${authUrl}/sign-up`}
      signInFallbackRedirectUrl="/account/teams/new"
      signUpFallbackRedirectUrl="/account/teams/new"
      taskUrls={{
        "choose-organization": "/account/teams/new",
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head />
        <body
          className={cn("dark bg-background min-h-screen antialiased", fonts)}
        >
          <NuqsAdapter>
            <TRPCReactProvider>
              {children}
              <Toaster />
            </TRPCReactProvider>
          </NuqsAdapter>
        </body>
      </html>
    </ClerkProvider>
  );
}
