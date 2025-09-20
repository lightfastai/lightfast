import type { Metadata, Viewport } from "next";

import "~/styles/globals.css";

import { siteConfig } from "@repo/site-config";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";
import { ThemeProvider } from "next-themes";
import { StructuredData } from "~/components/structured-data";

export const metadata: Metadata = {
	title: {
		default: "Lightfast Chat - Open-Source Model Agnostic AI Chat Interface",
		template: `%s | Lightfast Chat - Open-Source AI Chat`,
	},
	metadataBase: new URL("https://chat.lightfast.ai"),
	description:
		"Open-source, model agnostic AI chat interface. Connect to any AI model (GPT, Claude, Gemini, Llama) through one unified interface. Free and self-hostable.",
	keywords: [
		"open source AI chat",
		"model agnostic AI",
		"multi-model AI interface",
		"AI chat interface",
		"GPT chat interface",
		"Claude chat interface",
		"Gemini chat interface",
		"Llama chat interface",
		"self-hosted AI chat",
		"unified AI interface",
		"AI model switcher",
		"conversational AI",
		"AI chat platform",
		"open source chatbot",
		"developer AI tools",
		"AI API integration",
	],
	authors: [
		{
			name: siteConfig.name,
			url: siteConfig.url,
		},
	],
	creator: siteConfig.name,
	publisher: siteConfig.name,
	category: "Developer Tools",
	classification: "Business Software",
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
	openGraph: {
		type: "website",
		locale: "en_US",
		url: "https://chat.lightfast.ai",
		title: "Lightfast Chat - Open-Source Model Agnostic AI Chat Interface",
		description:
			"Open-source AI chat interface that works with any model. Connect to GPT, Claude, Gemini, Llama and more through one unified interface.",
		siteName: "Lightfast Chat",
		images: [
			{
				url: `${siteConfig.ogImage}`,
				width: 1200,
				height: 630,
				alt: "Lightfast Chat - Open-Source Model Agnostic AI Chat Interface",
				type: "image/jpeg",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		site: "@lightfastai",
		creator: "@lightfastai",
		title: "Lightfast Chat - Open-Source Model Agnostic AI Chat Interface",
		description:
			"Open-source AI chat interface that works with any model. Connect to GPT, Claude, Gemini, Llama and more.",
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
	applicationName: "Lightfast Chat",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Lightfast Chat",
		startupImage: "/apple-touch-icon.png",
	},
	formatDetection: {
		telephone: false,
	},
	other: {
		"mobile-web-app-capable": "yes",
		"apple-mobile-web-app-status-bar-style": "black-translucent",
		"google-site-verification": "PLACEHOLDER_VERIFICATION_CODE", // Replace with actual Google Search Console verification code
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
			signInFallbackRedirectUrl="/new"
			signUpFallbackRedirectUrl="/new"
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
					<StructuredData type="Organization" />
					<StructuredData type="WebApplication" />
				</head>
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
