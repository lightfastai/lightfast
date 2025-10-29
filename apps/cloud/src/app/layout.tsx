import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { siteConfig } from "@repo/site-config";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { authUrl, wwwUrl } from "~/lib/related-projects";
import { TRPCReactProvider } from "~/trpc/react";
import { HydrateClient } from "~/trpc/server";
import { StructuredData } from "~/components/structured-data";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Lightfast Cloud - Enterprise Agent Execution Platform",
  description:
    "Enterprise-grade cloud platform for deploying and scaling AI agents in production. Advanced orchestration, security, and monitoring for mission-critical agent workloads.",
  image: siteConfig.ogImage,
  metadataBase: new URL(siteConfig.url),
  applicationName: "Lightfast Cloud",
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
    url: `${siteConfig.url}/cloud`,
    title: "Lightfast Cloud - Enterprise Agent Execution Platform",
    description:
      "Enterprise-grade cloud platform for deploying and scaling AI agents in production. Advanced orchestration, security, and monitoring for mission-critical agent workloads.",
    siteName: "Lightfast Cloud",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Cloud - Enterprise Agent Execution Platform",
    description:
      "Enterprise-grade cloud platform for deploying and scaling AI agents in production. Advanced orchestration, security, and monitoring.",
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lightfast Cloud",
  },
  formatDetection: {
    telephone: false,
  },
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
    google: "lightfast-cloud-enterprise-platform",
  },
  category: "Technology",
  classification: "Enterprise AI Infrastructure Platform",
  referrer: "origin-when-cross-origin",
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
			signInFallbackRedirectUrl="/"
			signUpFallbackRedirectUrl="/"
			afterSignOutUrl={wwwUrl}
			waitlistUrl="/"
			taskUrls={{
				"choose-organization": `${authUrl}/select-organization`,
			}}
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
				<head>
					<StructuredData type="SoftwareApplication" />
				</head>
				<body className={cn("bg-background dark min-h-screen", fonts)}>
					<TRPCReactProvider>{children}</TRPCReactProvider>
					<Toaster />
				</body>
			</html>
		</ClerkProvider>
	);
}
