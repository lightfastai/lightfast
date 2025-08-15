import type { Metadata, Viewport } from "next";

import "@repo/ui/globals.css";

import { siteConfig } from "@repo/lightfast-config";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { PostHogProvider } from "@vendor/analytics/posthog-client";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";

import { createBaseUrl } from "~/lib/base-url";

export const metadata: Metadata = {
	title: {
		default: siteConfig.name,
		template: `%s - ${siteConfig.name}`,
	},
	metadataBase: new URL(siteConfig.url),
	description: siteConfig.description,
	keywords: [
		"Lightfast",
		"AI agents",
		"AI automation",
		"autonomous agents",
		"agent framework",
		"AI orchestration",
		"AI infrastructure",
		"developer tools",
		"AI development platform",
		"agent execution engine",
		"cloud-native AI",
		"AI workflow automation",
		"state machine orchestration",
		"AI agent deployment",
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
		url: siteConfig.url,
		title: siteConfig.name,
		description: siteConfig.description,
		siteName: siteConfig.name,
		images: [
			{
				url: siteConfig.ogImage,
				width: 1200,
				height: 630,
				alt: siteConfig.name,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: siteConfig.name,
		description: siteConfig.description,
		images: [siteConfig.ogImage],
		creator: siteConfig.links.twitter.href,
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
	applicationName: siteConfig.name,
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: siteConfig.name,
	},
	formatDetection: {
		telephone: false,
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
		<html lang="en" className="dark">
			<head />
			<body className={cn("bg-background min-h-screen dark", fonts)}>
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
