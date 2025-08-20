import React from "react";
import { HeroSection } from "~/components/landing/hero-section";
import { FrameworkShowcase } from "~/components/landing/framework-showcase";
import { BuildShipMonitorSection } from "~/components/landing/build-ship-monitor-section";
import { PlatformSection } from "~/components/landing/platform-section";
import { TemplatesSection } from "~/components/landing/templates-section";
import { BackgroundGrid } from "~/components/landing/background-grid";
import { Button } from "@repo/ui/components/ui/button";

export default function HomePage() {
	return (
		<div className="relative">
			<BackgroundGrid />

			{/* Hero section in light theme */}
			<div className="pt-12 pb-4 sm:pt-16 sm:pb-8 lg:pt-12 lg:pb-12 relative">
				<div className="mx-auto max-w-7xl space-y-12 sm:space-y-24 lg:space-y-32">
					<HeroSection />
					<FrameworkShowcase />
				</div>
			</div>

			{/* Go to Production section */}
			<div className="dark bg-background py-20 sm:py-24 lg:py-32">
				<div className="mx-auto max-w-7xl">
					<div className="space-y-16">
						<div className="space-y-2">
							<p className="text-lg sm:text-xl font-bold text-foreground">
								Go to production in minutes.
							</p>
							<div className="border-t border-border/50 mt-8" />
						</div>
						<div className="max-w-6xl">
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
			<div className="dark bg-background">
				<div className="mx-auto max-w-7xl">
					<PlatformSection />
				</div>
			</div>

			{/* Evals section */}
			<div className="dark bg-background py-20 sm:py-24 lg:py-32">
				<div className="mx-auto max-w-7xl">
					<div className="space-y-12">
						<div className="space-y-6">
							<div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-medium">
								<span>Why Run Evals?</span>
							</div>
							<h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
								Agents fail in unpredictable ways
							</h2>
						</div>

						<div className="grid md:grid-cols-2 gap-12 lg:gap-16">
							{/* Left side - Visual representation */}
							<div className="space-y-6">
								<div className="rounded-lg border bg-card p-6 space-y-4">
									<div className="flex items-center gap-4">
										<div className="font-mono text-sm bg-muted text-foreground px-3 py-1.5 rounded">
											AI IN YOUR APP
										</div>
										<div className="text-muted-foreground">→</div>
										<div className="space-y-2">
											<div className="text-sm font-medium text-foreground">
												SCORES
											</div>
											<div className="space-y-1 text-sm">
												<div className="flex items-center gap-2">
													<span className="text-green-500">✓</span>
													<span className="text-foreground">98% Toxicity</span>
												</div>
												<div className="flex items-center gap-2">
													<span className="text-green-500">✓</span>
													<span className="text-foreground">83% Accuracy</span>
												</div>
												<div className="flex items-center gap-2">
													<span className="text-red-500">✗</span>
													<span className="text-foreground">
														74% Hallucination
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
												<span className="text-green-500">✓</span>
												<span className="text-xs font-mono text-foreground">
													PROMPT A
												</span>
											</div>
											<div className="h-2 bg-muted rounded" />
											<div className="h-2 bg-muted rounded w-4/5" />
											<div className="h-2 bg-muted rounded w-3/5" />
										</div>
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<span className="text-red-500">✗</span>
												<span className="text-xs font-mono text-foreground">
													PROMPT B
												</span>
											</div>
											<div className="h-2 bg-muted rounded" />
											<div className="h-2 bg-muted rounded w-5/6" />
											<div className="h-2 bg-muted rounded w-2/3" />
										</div>
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<span className="text-green-500">✓</span>
												<span className="text-xs font-mono text-foreground">
													PROMPT C
												</span>
											</div>
											<div className="h-2 bg-muted rounded" />
											<div className="h-2 bg-muted rounded w-3/4" />
											<div className="h-2 bg-muted rounded w-1/2" />
										</div>
									</div>
								</div>

								<Button
									variant="outline"
									size="sm"
									className="w-fit text-foreground"
								>
									Get started with evals →
								</Button>
							</div>

							{/* Right side - Questions and explanations */}
							<div className="space-y-8">
								<div className="space-y-3">
									<h3 className="text-xl font-semibold text-foreground">
										How do you know your AI feature works?
									</h3>
									<p className="text-muted-foreground">
										Evals test your AI with real data and score the results. You
										can determine whether changes improve or hurt performance.
									</p>
								</div>

								<div className="space-y-3">
									<h3 className="text-xl font-semibold text-foreground">
										Are bad responses reaching users?
									</h3>
									<p className="text-muted-foreground">
										Production monitoring tracks live model responses and alerts
										you when quality drops or incorrect outputs increase.
									</p>
								</div>

								<div className="space-y-3">
									<h3 className="text-xl font-semibold text-foreground">
										Can your team improve quality without guesswork?
									</h3>
									<p className="text-muted-foreground">
										Side-by-side diffs allow you to compare the scores of
										different prompts and models, and see exactly why one
										version performs better than another.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Build, Ship, Monitor section */}
			<div className="mt-20 sm:mt-24 lg:mt-32">
				<BuildShipMonitorSection />
			</div>

			<div className="mt-20 sm:mt-24 lg:mt-32">
				<div className="mx-auto max-w-7xl space-y-20 sm:space-y-24 lg:space-y-32">
					<TemplatesSection />
				</div>
			</div>
		</div>
	);
}
