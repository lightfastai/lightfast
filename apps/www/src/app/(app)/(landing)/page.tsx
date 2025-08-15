import React from "react";
import { HeroSection } from "~/components/landing/hero-section";
import { PlatformSection } from "~/components/landing/platform-section";
import { FrameworkSection } from "~/components/landing/framework-section";
import { TemplatesSection } from "~/components/landing/templates-section";

export default function HomePage() {
	return (
		<div className="px-6 sm:px-8 lg:px-4 py-20 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-6xl space-y-20 sm:space-y-24 lg:space-y-32">
				<HeroSection />
				<PlatformSection />
				<FrameworkSection />
				<TemplatesSection />
			</div>
		</div>
	);
}
