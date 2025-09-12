import { PricingHero } from "~/components/pricing/pricing-hero";
import { PricingSimple } from "~/components/pricing/pricing-simple";
import { PricingFAQ } from "~/components/pricing/pricing-faq";

export default function PricingPage() {
	return (
		<>
			<div className="min-h-screen flex flex-col gap-16 mt-24 mb-24">
				{/* Hero Section */}
				<section className="relative">
					<div className="relative max-w-5xl mx-auto">
						<div className="py-8 px-4 sm:px-6 lg:px-8">
							<PricingHero />
						</div>
					</div>
				</section>

				{/* Simple Pricing Section - with border */}
				<section className="relative">
					<div className="relative max-w-5xl mx-auto">
						<div className="border border-border/50 rounded-lg py-8 px-4 sm:px-6 lg:px-8">
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