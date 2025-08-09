import { PricingHero } from "~/components/pricing/pricing-hero";
import { PricingSimple } from "~/components/pricing/pricing-simple";
import { PricingFAQ } from "~/components/pricing/pricing-faq";

export default function PricingPage() {
	return (
		<>
			<div className="min-h-screen">
				{/* Hero Section with grid background */}
				<section className="relative mt-24">
					{/* Top grid line - full width (thinner) */}
					<div className="absolute top-0 left-1/2 -translate-x-1/2 w-screen h-px bg-border/30"></div>

					<div className="relative max-w-5xl mx-auto">
						<div className="border-x border-t border-border/50 py-8 px-4 sm:px-6 lg:px-8">
							<PricingHero />
						</div>
					</div>

					{/* Bottom grid line - full width (thinner) */}
					<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-screen h-px bg-border/30"></div>
				</section>

				{/* Simple Pricing Section */}
				<section className="relative -mt-px">
					{/* Top grid line - full width (thinner) */}
					<div className="absolute top-0 left-1/2 -translate-x-1/2 w-screen h-px bg-border/30"></div>

					<div className="relative max-w-5xl mx-auto">
						<div className="border-x border-border/50 py-8 px-4 sm:px-6 lg:px-8">
							<PricingSimple />
						</div>
					</div>

					{/* Bottom grid line - full width (thinner) */}
					<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-screen h-px bg-border/30"></div>
				</section>

				{/* FAQ Section */}
				<section className="relative -mt-px mb-24">
					{/* Top grid line - full width (thinner) */}
					<div className="absolute top-0 left-1/2 -translate-x-1/2 w-screen h-px bg-border/30"></div>

					<div className="relative max-w-5xl mx-auto">
						<div className="border-x border-b border-border/50 py-8 px-4 sm:px-6 lg:px-8">
							<PricingFAQ />
						</div>
					</div>

					{/* Bottom grid line - full width (thinner) */}
					<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-screen h-px bg-border/30"></div>
				</section>
			</div>
		</>
	);
}
