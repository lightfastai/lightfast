import type { Metadata, Viewport } from "next";

import "@repo/ui/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { siteConfig } from "@repo/site-config";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: `${siteConfig.name} Experimental`,
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
    title: `${siteConfig.name} Experimental`,
    description: "Experimental AI chat interface",
    siteName: `${siteConfig.name} Experimental`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} Experimental`,
    description: "Experimental AI chat interface",
    images: ["/og.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
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
});

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
			<html lang="en" suppressHydrationWarning>
				<head />
				<body className={cn("bg-background dark min-h-screen", fonts)}>
					{children}
					<Toaster />
					<VercelAnalytics />
					<SpeedInsights />
				</body>
			</html>
		</ClerkProvider>
	);
}
