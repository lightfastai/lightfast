import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "AI Chatbot - Lightfast Example",
	description:
		"Production-ready AI chatbot built with Next.js, Vercel AI SDK, and Lightfast Core",
	keywords: [
		"AI",
		"chatbot",
		"Next.js",
		"Lightfast",
		"OpenAI",
		"Anthropic",
		"Claude",
	],
	authors: [{ name: "Lightfast Team" }],
	openGraph: {
		title: "AI Chatbot - Lightfast Example",
		description: "Production-ready AI chatbot with streaming responses",
		type: "website",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${inter.className} bg-background dark antialiased`}>
				{children}
			</body>
		</html>
	);
}
