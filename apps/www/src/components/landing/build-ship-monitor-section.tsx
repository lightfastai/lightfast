"use client";

import React, { useEffect, useRef, useState } from "react";

interface SectionContent {
	id: string;
	label: string;
	title: string;
	description: string;
	features: Array<{
		title: string;
		description: string;
	}>;
}

const sections: SectionContent[] = [
	{
		id: "build",
		label: "Build",
		title:
			"Develop production-ready agents with powerful orchestration and tooling",
		description: "",
		features: [
			{
				title: "State-machine orchestration",
				description:
					"Build complex agent workflows with deterministic execution, automatic retries, and graceful error handling.",
			},
			{
				title: "Resource management",
				description:
					"Intelligent scheduling of sandboxes, browser sessions, and API quotas with automatic cleanup and resource pooling.",
			},
			{
				title: "Human-in-the-loop",
				description:
					"Seamlessly integrate human approval workflows, feedback loops, and manual interventions into agent execution.",
			},
		],
	},
	{
		id: "ship",
		label: "Ship",
		title: "Deploy agents instantly with zero infrastructure setup",
		description: "",
		features: [
			{
				title: "One-click deployment",
				description:
					"Deploy to production in seconds with automatic scaling, load balancing, and failover.",
			},
			{
				title: "Version control & rollbacks",
				description:
					"Track agent versions, A/B test changes, and instantly rollback problematic deployments.",
			},
			{
				title: "Multi-region infrastructure",
				description:
					"Global edge network ensures low latency and high availability for your agents worldwide.",
			},
		],
	},
	{
		id: "monitor",
		label: "Monitor",
		title: "Real-time observability and control for production agents",
		description: "",
		features: [
			{
				title: "Execution tracing",
				description:
					"Debug agent behavior with detailed execution traces, decision trees, and step-by-step replay.",
			},
			{
				title: "Cost & performance metrics",
				description:
					"Track token usage, API costs, execution time, and resource consumption with automatic alerting.",
			},
			{
				title: "Safety guardrails",
				description:
					"Built-in monitoring for hallucinations, PII leaks, and policy violations with automatic circuit breakers.",
			},
		],
	},
];

export function BuildShipMonitorSection() {
	const [activeSection, setActiveSection] = useState(0);
	const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleScroll = () => {
			const windowHeight = window.innerHeight;
			const triggerPoint = windowHeight * 0.4;

			for (let i = sectionRefs.current.length - 1; i >= 0; i--) {
				const section = sectionRefs.current[i];
				if (section) {
					const rect = section.getBoundingClientRect();
					if (rect.top <= triggerPoint) {
						setActiveSection(i);
						break;
					}
				}
			}
		};

		window.addEventListener("scroll", handleScroll);
		handleScroll();

		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	}, []);

	return (
		<section
			ref={containerRef}
			className="w-screen relative left-[50%] right-[50%] -mx-[50vw] bg-background"
		>
			<div className="relative">
				{/* Scrollable sections with full-width borders */}
				<div>
					{sections.map((section, index) => (
						<div
							key={section.id}
							ref={(el) => {
								sectionRefs.current[index] = el;
							}}
							className="scroll-mt-24 border-t border-border first:border-t-0 last:border-b"
						>
							<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-0">
								<div className="lg:grid lg:grid-cols-2 lg:gap-16 py-32 lg:py-48">
									<div className="space-y-6">
										<p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
											{section.label}
										</p>
										<h3 className="text-2xl font-base leading-tight sm:text-3xl lg:text-2xl max-w-sm">
											{section.title}
										</h3>
										<div className="space-y-6 mt-8">
											{section.features.map((feature, featureIndex) => (
												<div key={featureIndex}>
													<h4 className="text-md font-semibold mb-2">
														{feature.title}
													</h4>
													<p className="text-sm text-muted-foreground max-w-sm">
														{feature.description}
													</p>
												</div>
											))}
										</div>
									</div>
									{/* Empty space for sticky panel */}
									<div className="hidden lg:block" />
								</div>
							</div>
						</div>
					))}
				</div>

				{/* Sticky panel - positioned absolutely */}
				<div className="hidden lg:block absolute top-0 right-0 w-full h-full pointer-events-none">
					<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-0 h-full">
						<div className="grid grid-cols-2 gap-16 h-full">
							{/* Empty left column */}
							<div />
							{/* Right column with sticky panel */}
							<div className="pointer-events-auto">
								<div className="sticky top-32 py-32">
									<div className="relative overflow-hidden rounded-xl border bg-card">
										<div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 to-emerald-900/20" />
										<div className="relative p-8 h-[600px] flex items-center justify-center">
											{/* 
												TODO: Replace with actual graphics based on section:
												
												BUILD Section (activeSection === 0):
												- State machine diagram showing nodes and connections
												- Workflow orchestration visualization with branching paths
												- Resource allocation grid showing sandbox/browser instances
												- Human approval flow diagram with decision points
												
												SHIP Section (activeSection === 1):
												- Deployment pipeline visualization (similar to CI/CD flow)
												- Global infrastructure map with edge locations
												- Version timeline with rollback capabilities
												- Performance metrics dashboard preview
												
												MONITOR Section (activeSection === 2):
												- Real-time metrics charts (cost, latency, tokens)
												- Alert system visualization with thresholds
												- Execution trace tree diagram
												- Live dashboard with multiple metric streams
												
												Style guidelines:
												- Use emerald-400/500 for primary accents
												- Dark background with subtle grid pattern
												- Clean, technical aesthetic like Braintrust examples
												- Animated/interactive elements on hover
												- Data-driven visualizations that feel alive
											*/}
											<div className="text-center space-y-4">
												<div className="text-6xl font-bold text-emerald-400">
													{activeSection === 0 && "⚙"}
													{activeSection === 1 && "🚀"}
													{activeSection === 2 && "📡"}
												</div>
												<p className="text-xl font-semibold text-foreground">
													{sections[activeSection]?.label}
												</p>
												<p className="text-sm text-muted-foreground max-w-xs mx-auto">
													{activeSection === 0 &&
														"Orchestrate complex agent workflows"}
													{activeSection === 1 &&
														"Deploy instantly to global infrastructure"}
													{activeSection === 2 &&
														"Real-time observability and control"}
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
