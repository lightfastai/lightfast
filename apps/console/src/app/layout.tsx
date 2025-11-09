import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { siteConfig } from "@repo/site-config";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@repo/console-trpc/react";
import { createMetadata } from "@vendor/seo/metadata";
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
			signInFallbackRedirectUrl="/onboarding/claim-org"
			signUpFallbackRedirectUrl="/onboarding/claim-org"
			taskUrls={{
				"choose-organization": "/onboarding/claim-org",
			}}
			appearance={{
				variables: {
					colorPrimary: "hsl(221.2 83.2% 53.3%)",
					colorBackground: "hsl(0 0% 3.9%)",
					colorInputBackground: "hsl(0 0% 14.9%)",
					colorInputText: "hsl(0 0% 98%)",
				},
			}}
		>
			<html lang="en" suppressHydrationWarning>
				<head />
				<body
					className={cn("dark bg-background min-h-screen antialiased", fonts)}
				>
					<TRPCReactProvider>
						{children}
						<Toaster />
					</TRPCReactProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
