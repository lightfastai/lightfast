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

export const metadata: Metadata = {
	title: {
		default: "Lightfast Cloud - Enterprise Agent Execution Platform",
		template: `%s | Lightfast Cloud - Enterprise AI Infrastructure`,
	},
	metadataBase: new URL(siteConfig.url),
	description: "Enterprise-grade cloud platform for deploying and scaling AI agents in production. Advanced orchestration, security, and monitoring for mission-critical agent workloads.",
	keywords: [
		"Lightfast Cloud",
		"enterprise AI platform",
		"agent deployment platform",
		"cloud agent infrastructure", 
		"production AI agents",
		"agent orchestration platform",
		"enterprise agent platform",
		"AI agent cloud platform",
		"scalable agent deployment",
		"managed AI infrastructure",
		"serverless agent platform",
		"cloud-native AI agents",
		"enterprise AI infrastructure",
		"agent execution engine",
		"AI platform for enterprise",
		"production agent deployment",
		"enterprise agent orchestration",
		"cloud agent management",
		"AI infrastructure platform",
		"agent platform as a service",
		"Vercel for AI agents alternative",
		"AWS Lambda for AI agents alternative", 
		"Google Cloud Run for AI alternative",
		"better than Kubernetes for AI",
		"Render alternative for AI agents",
		"Railway alternative for AI agents",
		"agent deployment service",
		"AI workload platform"
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
		url: `${siteConfig.url}/cloud`,
		title: "Lightfast Cloud - Enterprise Agent Execution Platform",
		description: "Enterprise-grade cloud platform for deploying and scaling AI agents in production. Advanced orchestration, security, and monitoring for mission-critical agent workloads.",
		siteName: "Lightfast Cloud",
		images: [
			{
				url: `${siteConfig.ogImage}`,
				width: 1200,
				height: 630,
				alt: "Lightfast Cloud - Enterprise Agent Execution Platform",
			},
		],
	},
	twitter: {
		card: "summary_large_image", 
		title: "Lightfast Cloud - Enterprise Agent Execution Platform",
		description: "Enterprise-grade cloud platform for deploying and scaling AI agents in production. Advanced orchestration, security, and monitoring.",
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
	applicationName: "Lightfast Cloud",
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
