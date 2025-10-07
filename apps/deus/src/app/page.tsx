"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { LandingHeader } from "~/components/landing/landing-header";
import {
	CheckIcon,
	GitMergeIcon,
	SearchIcon,
} from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/ui/accordion";

export default function LandingPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<LandingHeader />

			{/* Hero Section */}
			<section className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
				<div className="mx-auto max-w-7xl">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
						{/* Left: Hero Content */}
						<div>
							<h1 className="text-6xl font-bold tracking-tight mb-6">Deus</h1>
							<p className="text-xl text-muted-foreground mb-8 max-w-lg">
								One agent for everywhere you code—included in ChatGPT Plus, Pro,
								Business, Edu, and Enterprise plans.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 items-start">
								<Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
									Get started
								</Button>
								<div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border border-border font-mono text-sm">
									<span className="text-muted-foreground">$</span>
									<span>npm i -g @openai/deus</span>
									<button
										className="ml-2 text-muted-foreground hover:text-foreground"
										onClick={() =>
											navigator.clipboard.writeText("npm i -g @openai/deus")
										}
									>
										<svg
											className="h-4 w-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
											<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
										</svg>
									</button>
								</div>
							</div>
						</div>

						{/* Right: Floating Cards */}
						<div className="relative h-[400px] hidden lg:block">
							{/* Code Review Card */}
							<div className="absolute top-0 right-0 w-64 p-4 rounded-xl bg-card/50 backdrop-blur border border-border">
								<div className="flex items-center gap-2 mb-2">
									<div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
										<CheckIcon className="h-4 w-4" />
									</div>
									<span className="font-medium">Code review</span>
								</div>
							</div>

							{/* Searching Card */}
							<div className="absolute top-20 right-32 w-80 p-4 rounded-xl bg-card/50 backdrop-blur border border-border">
								<div className="flex items-center gap-2">
									<SearchIcon className="h-5 w-5 text-chart-1" />
									<span className="font-medium">Searching co...</span>
								</div>
							</div>

							{/* Git Branch Card */}
							<div className="absolute top-48 right-12 w-56 p-4 rounded-xl bg-card/50 backdrop-blur border border-border">
								<div className="mb-2">
									<div className="flex items-center gap-2 mb-2">
										<GitMergeIcon className="h-4 w-4" />
										<span className="text-sm">eb/agi</span>
									</div>
								</div>
							</div>

							{/* Merged Card */}
							<div className="absolute bottom-0 right-24 w-48 p-4 rounded-xl bg-card/50 backdrop-blur border border-border">
								<div className="flex items-center gap-2 mb-2">
									<GitMergeIcon className="h-4 w-4 text-chart-2" />
									<span className="font-medium">Merged</span>
								</div>
								<div className="flex gap-2 text-sm">
									<span className="text-green-600 dark:text-green-400">+27</span>
									<span className="text-red-600 dark:text-red-400">-15</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* FAQ Section */}
			<section className="py-20 px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-7xl">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						{/* Top row - heading on left */}
						<div className="space-y-4">
							<h2 className="text-4xl font-bold tracking-tight">
								Frequently Asked Questions
							</h2>
							<p className="text-lg text-muted-foreground">
								Everything you need to know about Deus
							</p>
						</div>
						<div></div>

						{/* FAQ content spanning full width */}
						<div className="md:col-span-2 mt-8">
							<Accordion type="single" collapsible className="w-full">
								<AccordionItem value="item-0">
									<AccordionTrigger className="text-left">
										What is Deus?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Deus is an intelligent orchestrator and router that connects you with the best AI agents for any task. It automatically routes your requests to specialized agents for coding (Codex, Claude, CodeRabbit), task management (Linear), version control (GitHub), and more. We're continuously expanding to support agents for finance, legal, and other domains.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-1">
									<AccordionTrigger className="text-left">
										How does Deus decide which agent to use?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Deus uses advanced routing logic to analyze your request and determine the most appropriate agent. For code reviews, it might route to CodeRabbit. For complex implementations, it might use Claude or Codex. For task creation, it routes to Linear. You can also manually specify which agent you'd like to use.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-2">
									<AccordionTrigger className="text-left">
										Which agents and integrations does Deus support?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Deus currently supports coding agents (Codex, Claude, CodeRabbit), development tools (GitHub, Lightfast Cloud), and task management (Linear). We're actively expanding to include agents for finance, legal, and other business workflows. New integrations are added regularly based on user demand.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-3">
									<AccordionTrigger className="text-left">
										Can I use Deus with my existing workflows?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Yes! Deus integrates seamlessly with your existing tools. Connect your GitHub repositories, Linear workspace, and other services. Deus will automatically route tasks to the appropriate agents, whether it's reviewing PRs, creating tasks, or handling other workflow automation.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-4">
									<AccordionTrigger className="text-left">
										How much does Deus cost?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Deus is currently in early access. Pricing will be announced soon. Join our waitlist to be notified when we launch and get early access pricing.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-5">
									<AccordionTrigger className="text-left">
										Is Deus suitable for teams?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Absolutely! Deus is built for teams and organizations. It supports organization-based collaboration, shared workflows, audit logs, and team-wide agent configurations. Scale your AI-assisted workflows across your entire organization—from engineering to finance to legal.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-6">
									<AccordionTrigger className="text-left">
										What makes Deus different from using agents directly?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Instead of managing multiple agent subscriptions and deciding which tool to use for each task, Deus provides a single interface that intelligently routes to the best agent. It's like having an expert assistant who knows which specialist to call for every job—whether that's code, finance, legal, or project management.
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
