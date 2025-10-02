import type { Metadata, Viewport } from "next";

import "@repo/ui/globals.css";

import { siteConfig } from "@repo/site-config";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";

export const metadata: Metadata = {
  title: {
    default: "Deus - AI Workflow Orchestration",
    template: `%s - Deus`,
  },
  metadataBase: new URL("https://deus.lightfast.ai"),
  description: "Build powerful AI workflow orchestration with natural language. Connect AI to any tool via MCP and automate complex workflows without code.",
  keywords: ["Lightfast", "Deus", "AI", "Workflow", "Orchestration", "MCP", "Automation"],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://deus.lightfast.ai",
    title: "Deus - AI Workflow Orchestration",
    description: "Build powerful AI workflow orchestration with natural language. Connect AI to any tool via MCP and automate complex workflows without code.",
    siteName: siteConfig.name,
    images: [{
      url: siteConfig.ogImage,
      width: 1200,
      height: 630,
      alt: siteConfig.name,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deus - AI Workflow Orchestration",
    description: "Build powerful AI workflow orchestration with natural language. Connect AI to any tool via MCP and automate complex workflows without code.",
    images: [siteConfig.ogImage],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
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
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn("bg-background dark min-h-screen", fonts)}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
