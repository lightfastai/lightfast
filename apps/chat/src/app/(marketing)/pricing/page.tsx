import type { Metadata } from "next";
import { PricingHero } from "~/components/pricing-hero";
import { PricingSimple } from "~/components/pricing-simple";
import { PricingFAQ } from "~/components/pricing-faq";
import { StructuredData } from "~/components/structured-data";

export const metadata: Metadata = {
	title: "Pricing - Free Open-Source AI Chat Interface",
	description: "Lightfast Chat is completely free and open-source. No hidden costs, no subscription fees. Download, self-host, or use our hosted version for free. Compare our pricing with other AI chat platforms.",
	keywords: [
		"Lightfast pricing",
		"free AI chat",
		"open source AI chat cost",
		"AI chat platform pricing",
		"free ChatGPT alternative",
		"self-hosted AI chat",
		"no subscription AI chat",
		"AI chat interface cost",
		"free conversational AI",
		"open source vs paid AI chat",
		"Lightfast Chat plans",
		"AI model pricing comparison",
	],
	openGraph: {
		title: "Lightfast Chat Pricing - Free Open-Source AI Chat Interface",
		description: "Completely free and open-source AI chat interface. No subscription fees. Self-host or use our hosted version for free.",
		url: "https://chat.lightfast.ai/pricing",
		type: "website",
		images: [
			{
				url: "https://lightfast.ai/og.jpg",
				width: 1200,
				height: 630,
				alt: "Lightfast Chat - Free Open-Source AI Chat Interface",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Lightfast Chat Pricing - Free Open-Source AI Chat Interface",
		description: "Completely free and open-source AI chat interface. No subscription fees. Self-host or use our hosted version for free.",
		images: ["https://lightfast.ai/og.jpg"],
	},
	alternates: {
		canonical: "https://chat.lightfast.ai/pricing",
	},
};

export default function PricingPage() {
	return (
		<>
			<StructuredData 
				type="SoftwareApplication" 
				additionalData={{
					offers: [
						{
							"@type": "Offer",
							name: "Open Source License",
							price: "0",
							priceCurrency: "USD",
							availability: "https://schema.org/InStock",
							description: "Free and open-source forever"
						}
					],
					"isAccessibleForFree": true,
					"license": "https://github.com/lightfastai/lightfast/blob/main/LICENSE"
				}}
			/>
			<div className="min-h-screen flex flex-col gap-4 py-16">
				{/* Hero Section */}
				<section className="relative">
					<div className="relative max-w-5xl mx-auto">
						<div className="py-8 px-4 sm:px-6 lg:px-8">
							<PricingHero />
						</div>
					</div>
				</section>

				{/* Simple Pricing Section */}
				<section className="relative">
					<div className="relative max-w-5xl mx-auto">
						<div className="py-8 px-4 sm:px-6 lg:px-8">
							<PricingSimple />
						</div>
					</div>
				</section>

				{/* FAQ Section */}
				<section className="relative">
					<div className="relative max-w-5xl mx-auto">
						<div className="py-8 px-4 sm:px-6 lg:px-8">
							<PricingFAQ />
						</div>
					</div>
				</section>
			</div>
		</>
	);
}
