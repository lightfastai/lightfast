import type { Metadata, Viewport } from "next";

import "@repo/ui/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { siteConfig } from "@repo/site-config";
import { Toaster } from "sonner";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";

export const metadata: Metadata = {
	title: {
		default: `${siteConfig.name} Auth`,
		template: `%s - ${siteConfig.name} Auth`,
	},
	metadataBase: new URL(siteConfig.url),
	description: `Authentication portal for ${siteConfig.name} platform`,
	keywords: [
		"Lightfast Auth",
		"AI platform authentication",
		"secure login",
		"developer authentication",
		"SSO",
		"OAuth",
		"API authentication",
		"agent platform login",
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
		title: `${siteConfig.name} Auth`,
		description: `Authentication portal for ${siteConfig.name} platform`,
		siteName: `${siteConfig.name} Auth`,
		images: [
			{
				url: siteConfig.ogImage,
				width: 1200,
				height: 630,
				alt: `${siteConfig.name} Auth`,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: `${siteConfig.name} Auth`,
		description: `Authentication portal for ${siteConfig.name} platform`,
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
	applicationName: `${siteConfig.name} Auth`,
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: `${siteConfig.name} Auth`,
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
		<ClerkProvider
			publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
			signInUrl="/sign-in"
			signUpUrl="/sign-up"
			signInFallbackRedirectUrl="/select-organization"
			signUpFallbackRedirectUrl="/select-organization"
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
				<body className={cn("bg-background dark min-h-screen", fonts)}>
					{children}
					<Toaster theme="dark" position="bottom-right" />
					<VercelAnalytics />
					<SpeedInsights />
				</body>
			</html>
		</ClerkProvider>
	);
}
