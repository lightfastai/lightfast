import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Lightfast Experimental",
	description: "Experimental AI chat interface",
	metadataBase: new URL("https://experimental.lightfast.ai"),
	robots: {
		index: false,
		follow: false,
		nocache: true,
		googleBot: {
			index: false,
			follow: false,
			noimageindex: true,
			"max-video-preview": -1,
			"max-image-preview": "none",
			"max-snippet": -1,
		},
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		url: "https://experimental.lightfast.ai",
		title: "Lightfast Experimental",
		description: "Experimental AI chat interface",
		siteName: "Lightfast Experimental",
		images: [
			{
				url: "/og.jpg",
				width: 1200,
				height: 630,
				alt: "Lightfast Experimental",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Lightfast Experimental",
		description: "Experimental AI chat interface",
		images: ["/og.jpg"],
	},
	icons: {
		icon: [
			{ url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
		],
		apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
		other: [
			{
				rel: "android-chrome-192x192",
				url: "/android-chrome-192x192.png",
			},
			{
				rel: "android-chrome-512x512",
				url: "/android-chrome-512x512.png",
			},
		],
	},
};

export const viewport: Viewport = {
	themeColor: "#0a0a0a",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ClerkProvider
			signInUrl="/sign-in"
			signInFallbackRedirectUrl="/"
			appearance={{
				baseTheme: dark,
				variables: {
					colorPrimary: "#3b82f6",
					colorBackground: "#0a0a0a",
					colorInputBackground: "#18181b",
					colorInputText: "#fafafa",
				},
			}}
		>
			<html lang="en">
				<body className={`${geistSans.variable} ${geistMono.variable} dark antialiased`}>
					{children}
					<Analytics />
					<SpeedInsights />
				</body>
			</html>
		</ClerkProvider>
	);
}
