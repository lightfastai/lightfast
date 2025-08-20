import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { siteConfig } from "@repo/lightfast-config";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { getClerkConfig } from "@repo/url-utils";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
	title: {
		default: "Lightfast Chat",
		template: `%s - Lightfast Chat`,
	},
	metadataBase: new URL(siteConfig.url),
	description: "Real-time chat application powered by Lightfast",
	keywords: [
		"Lightfast Chat",
		"AI chat interface",
		"agent conversation",
		"developer chat",
		"AI assistant chat",
		"real-time AI communication",
		"agent messaging platform",
		"collaborative AI workspace",
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
		title: "Lightfast Chat",
		description: "Real-time chat application powered by Lightfast",
		siteName: "Lightfast Chat",
		images: [
			{
				url: siteConfig.ogImage,
				width: 1200,
				height: 630,
				alt: "Lightfast Chat",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Lightfast Chat",
		description: "Real-time chat application powered by Lightfast",
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
	applicationName: "Lightfast Chat",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Lightfast Chat",
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
	const clerkConfig = getClerkConfig("chat");

	return (
		<ClerkProvider
			publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
			{...clerkConfig}
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
				<head />
				<body className={cn("bg-background min-h-screen", fonts)}>
					<ThemeProvider
						attribute="class"
						defaultTheme="dark"
						enableSystem={false}
						disableTransitionOnChange
					>
						{children}
						<Toaster />
					</ThemeProvider>
					<VercelAnalytics />
					<SpeedInsights />
				</body>
			</html>
		</ClerkProvider>
	);
}
