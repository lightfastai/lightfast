import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { siteConfig } from "@repo/site-config";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { PostHogProvider } from "@vendor/analytics/posthog-client";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";

import { createBaseUrl } from "~/lib/base-url";
import { StructuredData } from "~/components/structured-data";

export const metadata: Metadata = {
	title: {
		default: "Lightfast - Cloud-Native Agent Execution Engine for Production AI",
		template: `%s | Lightfast - AI Agent Infrastructure`,
	},
	metadataBase: new URL(siteConfig.url),
	description: "The infrastructure layer for the agent economy. Build production-ready AI agents with cloud-native execution engine. Advanced orchestration, resource scheduling, and enterprise-grade security. Deploy in minutes, not days.",
	keywords: [
		// Core positioning
		"AI agent platform",
		"cloud-native agent execution", 
		"agent infrastructure",
		"production AI agents",
		"enterprise AI platform",
		
		// vs Competitors 
		"Langchain alternative",
		"CrewAI alternative", 
		"better than Trigger.dev for AI",
		"AI agent orchestration platform",
		
		// Technical features
		"state machine orchestration",
		"resource scheduling AI",
		"human-in-the-loop AI",
		"AI agent deployment",
		"agent execution engine",
		"AI workflow automation",
		
		// Developer focused
		"developer AI platform",
		"AI infrastructure tools",
		"scalable AI agents",
		"AI agent development",
		"agent framework",
		"AI development platform",
		
		// Business value
		"enterprise AI infrastructure",
		"production-ready AI",
		"AI agent economy",
		"agent deployment platform",
	],
	authors: [
		{
			name: siteConfig.name,
			url: siteConfig.url,
		},
	],
	creator: siteConfig.name,
	publisher: siteConfig.name,
	category: "Technology",
	classification: "AI Infrastructure Platform",
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
		google: "PLACEHOLDER_VERIFICATION_CODE", // Replace with actual Google Search Console verification code
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		url: siteConfig.url,
		title: "Lightfast - Cloud-Native Agent Execution Engine for Production AI",
		description: "The infrastructure layer for the agent economy. Deploy production-ready AI agents with advanced orchestration, resource scheduling, and enterprise security.",
		siteName: siteConfig.name,
		images: [
			{
				url: siteConfig.ogImage,
				width: 1200,
				height: 630,
				alt: "Lightfast - Cloud-Native Agent Execution Engine for Production AI",
				type: "image/jpeg",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		site: "@lightfastai",
		creator: "@lightfastai",
		title: "Lightfast - Cloud-Native Agent Execution Engine for Production AI", 
		description: "The infrastructure layer for the agent economy. Deploy production-ready AI agents with advanced orchestration and enterprise security.",
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
	applicationName: "Lightfast AI Agent Platform",
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
			<head>
				<StructuredData type="Organization" />
				<StructuredData type="WebSite" />
				<StructuredData type="SoftwareApplication" />
			</head>
			<body className={cn("min-h-screen", fonts)}>
				<PostHogProvider baseUrl={createBaseUrl()}>
					{children}
					<Toaster />
					<VercelAnalytics />
					<SpeedInsights />
				</PostHogProvider>
			</body>
		</html>
	);
}
