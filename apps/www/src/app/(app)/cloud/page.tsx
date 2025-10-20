import React from "react";
import { HeroSection } from "~/components/landing/hero-section";
import { FrameworkShowcase } from "~/components/landing/framework-showcase";
// import { BuildShipMonitorSection } from "~/components/landing/build-ship-monitor-section";
import { PlatformSection } from "~/components/landing/platform-section";
import { WhyCloudInfrastructureSection } from "~/components/landing/why-cloud-infrastructure-section";
// import { TemplatesSection } from "~/components/landing/templates-section";
import { BackgroundGrid } from "~/components/landing/background-grid";

export default function CloudPage() {

	return (
		<div className="relative">
			<BackgroundGrid />

			{/* Hero section in light theme */}
			<div className="pt-12 pb-4 sm:pt-16 sm:pb-8 lg:pt-12 lg:pb-12 relative px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl space-y-12 sm:space-y-24 lg:space-y-32">
					<HeroSection />
					<FrameworkShowcase />
				</div>
			</div>

			{/* Go to Production section */}
			<div className="dark bg-background py-20 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl">
					<div className="space-y-16">
						<div className="space-y-2">
							<p className="text-lg sm:text-xl font-bold text-foreground">
								Go to production in minutes.
							</p>
							<div className="border-t border-border/50 mt-8" />
						</div>
						<div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl">
							<p className="text-3xl sm:text-4xl lg:text-5xl leading-tight text-foreground font-light">
								<span className="ml-[20%] sm:ml-[25%] lg:ml-[30%]">"L</span>
								ightfast is the production-ready agent platform that handles
								authentication, observability, error handling, and deployment
								out of the box. Build agents with simple APIs while we manage
								the infrastructure complexity, so you can ship to production in
								minutes, not weeks."
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Platform section - dark theme */}
			<div className="dark bg-background px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl">
					<PlatformSection />
				</div>
			</div>

			{/* Why Cloud Infrastructure section */}
			<WhyCloudInfrastructureSection />

			{/* Build, Ship, Monitor section - full width */}
			{/* <div className="bg-background">
				<BuildShipMonitorSection />
			</div> */}

			{/* <div className="mt-20 sm:mt-24 lg:mt-32">
				<div className="mx-auto max-w-7xl space-y-20 sm:space-y-24 lg:space-y-32">
					<TemplatesSection />
				</div>
			</div> */}
		</div>
	);
}
