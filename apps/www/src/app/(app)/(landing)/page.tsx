import React from "react";
import { HeroSection } from "~/components/landing/hero-section";
import { PlatformSection } from "~/components/landing/platform-section";
import { TemplatesSection } from "~/components/landing/templates-section";

export default function HomePage() {
	return (
		<div>
			{/* Hero section in light theme */}
			<div className="framework bg-background pt-20 pb-8 sm:py-24 lg:py-42">
				<div className="mx-auto max-w-7xl space-y-20 sm:space-y-24 lg:space-y-32">
					<HeroSection />
				</div>
			</div>

			{/* Platform section - dark theme */}
			<div className="dark bg-background py-20 sm:py-24 lg:py-32">
				<div className="mx-auto max-w-7xl">
					<PlatformSection />
				</div>
			</div>

			<div className="mt-20 sm:mt-24 lg:mt-32">
				<div className="mx-auto max-w-7xl space-y-20 sm:space-y-24 lg:space-y-32">
					<TemplatesSection />
				</div>
			</div>
		</div>
	);
}
