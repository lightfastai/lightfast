import React from "react";
import { HeroSection } from "~/components/landing/hero-section";
import { FrameworkShowcase } from "~/components/landing/framework-showcase";
// import { BuildShipMonitorSection } from "~/components/landing/build-ship-monitor-section";
import { PlatformSection } from "~/components/landing/platform-section";
import { TemplatesSection } from "~/components/landing/templates-section";
import { BackgroundGrid } from "~/components/landing/background-grid";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

export default function HomePage() {
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
								minutes, not weeks." — Jeevan Pillay
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
			<div className="dark bg-background py-20 sm:py-24 lg:pt-32 lg:pb-56 px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl">
					<div className="space-y-12">
						<div className="space-y-6">
							<div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-medium">
								<span>Why Cloud Infrastructure?</span>
							</div>
							<h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
								Building agent infrastructure is complex
							</h2>
						</div>

						<div className="grid md:grid-cols-2 gap-12 lg:gap-16">
							{/* Left side - Visual representation */}
							<div className="space-y-6">
								<div className="rounded-lg border bg-card p-6 space-y-4">
									<div className="flex items-center gap-4">
										<div className="font-mono text-sm bg-muted text-foreground px-3 py-1.5 rounded">
											DIY INFRASTRUCTURE
										</div>
										<div className="text-muted-foreground">→</div>
										<div className="space-y-2">
											<div className="text-sm font-medium text-foreground">
												CHALLENGES
											</div>
											<div className="space-y-1 text-sm">
												<div className="flex items-center gap-2">
													<span className="text-red-500">✗</span>
													<span className="text-foreground">
														Resource leaks
													</span>
												</div>
												<div className="flex items-center gap-2">
													<span className="text-red-500">✗</span>
													<span className="text-foreground">
														Scaling issues
													</span>
												</div>
												<div className="flex items-center gap-2">
													<span className="text-red-500">✗</span>
													<span className="text-foreground">
														Security vulnerabilities
													</span>
												</div>
											</div>
										</div>
									</div>
								</div>

								<div className="rounded-lg border bg-card p-6">
									<div className="grid grid-cols-3 gap-4">
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<span className="text-orange-500">!</span>
												<span className="text-xs font-mono text-foreground">
													SANDBOX
												</span>
											</div>
											<div className="h-2 bg-muted rounded" />
											<div className="h-2 bg-red-500/20 rounded w-4/5" />
											<div className="h-2 bg-muted rounded w-3/5" />
										</div>
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<span className="text-red-500">✗</span>
												<span className="text-xs font-mono text-foreground">
													BROWSER
												</span>
											</div>
											<div className="h-2 bg-muted rounded" />
											<div className="h-2 bg-red-500/20 rounded w-5/6" />
											<div className="h-2 bg-red-500/20 rounded w-2/3" />
										</div>
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<span className="text-green-500">✓</span>
												<span className="text-xs font-mono text-foreground">
													API
												</span>
											</div>
											<div className="h-2 bg-muted rounded" />
											<div className="h-2 bg-muted rounded w-3/4" />
											<div className="h-2 bg-muted rounded w-1/2" />
										</div>
									</div>
								</div>

								<Link href="http://localhost:4103">
									<Button
										variant="outline"
										size="sm"
										className="w-fit text-foreground"
									>
										Join our waitlist →
									</Button>
								</Link>
							</div>

							{/* Right side - Questions and explanations */}
							<div className="space-y-8">
								<div className="space-y-3">
									<h3 className="text-xl font-semibold text-foreground">
										Are your sandboxes leaking resources?
									</h3>
									<p className="text-muted-foreground">
										Unmanaged containers and browser sessions accumulate costs.
										Our platform automatically cleans up resources and pools
										connections for efficiency.
									</p>
								</div>

								<div className="space-y-3">
									<h3 className="text-xl font-semibold text-foreground">
										Can you handle sudden traffic spikes?
									</h3>
									<p className="text-muted-foreground">
										Agent workloads are unpredictable. We provide auto-scaling
										infrastructure that handles bursts while maintaining
										consistent performance.
									</p>
								</div>

								<div className="space-y-3">
									<h3 className="text-xl font-semibold text-foreground">
										How do you secure agent execution?
									</h3>
									<p className="text-muted-foreground">
										Agents need isolated environments with proper sandboxing.
										Our infrastructure provides secure execution with built-in
										safety rails and monitoring.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

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
