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
		id: "iterate",
		label: "ITERATE",
		title: "Refine prompt and eval ideas fast with playgrounds",
		description: "",
		features: [
			{
				title: "Fast prompt engineering",
				description:
					"Tune prompts, swap models, edit scorers, and run evaluations directly in the browser. Compare traces side-by-side to see exactly what changed.",
			},
			{
				title: "Batch testing",
				description:
					"Run your prompts against hundreds or thousands of real or synthetic examples to understand performance across scenarios.",
			},
			{
				title: "AI-assisted workflows",
				description:
					"Automate writing and optimizing prompts, scorers, and datasets with Loop, our built-in agent.",
			},
		],
	},
	{
		id: "eval",
		label: "EVAL",
		title: "Run comprehensive tests on every prompt change to measure accuracy, consistency, and safety",
		description: "",
		features: [
			{
				title: "Quantifiable progress",
				description:
					"Measure changes against your own benchmarks to make data-driven decisions.",
			},
			{
				title: "Quality and safety gates",
				description:
					"Prevent quality regressions and unsafe outputs from reaching users.",
			},
			{
				title: "Automated and human scoring",
				description:
					"Run automated tests on every change, then layer human feedback to capture the nuance machines miss.",
			},
		],
	},
	{
		id: "ship",
		label: "SHIP",
		title: "Track production AI applications with real-time monitoring and online scoring",
		description: "",
		features: [
			{
				title: "Live performance monitoring",
				description:
					"Track latency, cost, and custom quality metrics as real traffic flows through your application.",
			},
			{
				title: "Automations and alerts",
				description:
					"Configure alerts that trigger when quality thresholds are crossed or safety rails trip.",
			},
			{
				title: "Scalable log ingestion",
				description:
					"Ingest and store all application logs with Brainstore, purpose-built for searching and analyzing AI interactions at enterprise scale.",
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
			if (!containerRef.current) return;

			const containerTop = containerRef.current.getBoundingClientRect().top;
			const windowHeight = window.innerHeight;
			const triggerPoint = windowHeight * 0.4;

			for (let i = sectionRefs.current.length - 1; i >= 0; i--) {
				const section = sectionRefs.current[i];
				if (section) {
					const rect = section.getBoundingClientRect();
					if (rect.top - containerTop <= triggerPoint) {
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
		<section ref={containerRef} className="py-20 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="mb-12 text-center">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
						Build, Ship, Monitor
					</h2>
					<p className="mt-4 text-lg text-muted-foreground">
						The complete toolkit for production AI applications
					</p>
				</div>

				<div className="relative">
					<div className="lg:grid lg:grid-cols-2 lg:gap-16">
						<div className="space-y-32 lg:space-y-48">
							{sections.map((section, index) => (
								<div
									key={section.id}
									ref={(el) => {
										sectionRefs.current[index] = el;
									}}
									className="scroll-mt-24"
								>
									<div className="space-y-6">
										<p className="text-xs font-mono text-muted-foreground">
											{section.label}
										</p>
										<h3 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
											{section.title}
										</h3>
										<div className="space-y-6 mt-8">
											{section.features.map((feature, featureIndex) => (
												<div key={featureIndex}>
													<h4 className="text-lg font-semibold mb-2">
														{feature.title}
													</h4>
													<p className="text-muted-foreground">
														{feature.description}
													</p>
												</div>
											))}
										</div>
									</div>
								</div>
							))}
						</div>

						<div className="hidden lg:block">
							<div className="sticky top-32">
								<div className="relative overflow-hidden rounded-xl border bg-card">
									<div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 to-emerald-900/20" />
									<div className="relative p-8 h-[600px] flex items-center justify-center">
										<div className="text-center space-y-4">
											<div className="text-6xl font-bold text-emerald-400">
												{activeSection === 0 && "🔄"}
												{activeSection === 1 && "📊"}
												{activeSection === 2 && "📈"}
											</div>
											<p className="text-xl font-semibold text-foreground">
												{sections[activeSection]?.label}
											</p>
											<p className="text-sm text-muted-foreground max-w-xs mx-auto">
												{activeSection === 0 &&
													"Rapid iteration with playground tools"}
												{activeSection === 1 &&
													"Comprehensive testing and evaluation"}
												{activeSection === 2 &&
													"Real-time monitoring and alerts"}
											</p>
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