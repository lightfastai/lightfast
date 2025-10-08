"use client";

import React from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { getAppUrl } from "@repo/url-utils";
import { DeusIntegrationShowcase } from "~/components/landing/deus-integration-showcase";
import { DeusIntegrationsSection } from "~/components/landing/deus-integrations-section";

export default function HomePage() {
	const [copied, setCopied] = React.useState(false);
	const deusUrl = getAppUrl("deus");

	const copyToClipboard = async () => {
		await navigator.clipboard.writeText("npm install -g @lightfastai/deus");
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};
	return (
		<div className="relative min-h-screen">
			{/* Hero Section */}
			<section className="relative mx-auto max-w-7xl py-32 sm:py-8 lg:py-16">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
					{/* Left Column - Content */}
					<div>
						{/* Status Badge */}
						<div className="mb-12">
							<Badge
								variant="outline"
								className="gap-2 bg-muted/50 px-3 py-1.5 text-xs uppercase tracking-widest backdrop-blur-sm"
							>
								<span className="text-foreground/80">Introducing</span>
							</Badge>
						</div>

						{/* Hero Title */}
						<h1 className="mb-8 max-w-2xl font-serif text-5xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-6xl lg:text-5xl">
							<Link
								href={deusUrl}
								className="underline decoration-2 underline-offset-4 transition-colors hover:text-primary"
							>
								Deus
							</Link>{" "}
							is the intelligent agent router for developers and founders to
							build and iterate faster.
						</h1>

						{/* Supporting Description */}
						<p className="mb-12 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
							One interface, infinite agents. Unified interface to connect all
							your existing apps and tools. Manages context and sessions
							intelligently for you while you build your product.
						</p>

						{/* Installation */}
						<div className="max-w-md">
							<p className="mb-4 text-sm text-muted-foreground">
								Install Node.js 18+, then run:
							</p>
							<div className="group relative overflow-hidden rounded-lg border bg-muted/30 p-3 backdrop-blur-sm">
								<code className="font-mono text-base text-foreground/90">
									<span className="text-primary">npm install</span>
									<span className="text-muted-foreground"> -g</span>
									<span className="text-foreground/90"> @lightfastai/deus</span>
								</code>
								<Button
									onClick={copyToClipboard}
									variant="ghost"
									size="icon"
									className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
									aria-label="Copy to clipboard"
								>
									{copied ? (
										<Check className="h-4 w-4 text-green-500" />
									) : (
										<Copy className="h-4 w-4 text-muted-foreground" />
									)}
								</Button>
							</div>
						</div>
					</div>

					{/* Right Column - Image Placeholder */}
					<div className="hidden lg:block">
						{/* Future image will go here */}
					</div>
				</div>
			</section>

			<section className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl px-6 pb-16 sm:pb-20">
				<DeusIntegrationShowcase />
			</section>

			<DeusIntegrationsSection />

			{/* Agents Section */}
			<section className="relative border-t border-b bg-muted/20 py-32">
				<div className="mx-auto max-w-7xl px-6">
					<div className="text-center mb-16">
						<h2 className="mb-6 font-serif text-3xl text-foreground sm:text-4xl">
							One interface,{" "}
							<span className="text-primary">infinite agents</span>
						</h2>
						<p className="mx-auto max-w-2xl text-lg text-muted-foreground">
							Deus connects you to the best AI agents for any domain
						</p>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 items-start">
						{/* Agent Grid */}
						<Card className="border-muted/50 bg-muted/30 backdrop-blur-sm p-8">
							<div className="grid grid-cols-3 gap-8">
								{[
									{ name: "Claude Code", category: "Development" },
									{ name: "Codex", category: "Code Generation" },
									{ name: "CodeRabbit", category: "Code Review" },
									{ name: "Linear", category: "Task Management" },
									{ name: "GitHub", category: "Version Control" },
									{ name: "Vercel", category: "Deployment" },
									{ name: "Supabase", category: "Backend" },
									{ name: "Stripe", category: "Payments" },
									{ name: "Resend", category: "Email" },
								].map((agent) => (
									<div
										key={agent.name}
										className="flex flex-col items-center justify-center text-center"
									>
										<div className="font-semibold text-foreground mb-1">
											{agent.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{agent.category}
										</div>
									</div>
								))}
							</div>
						</Card>

						{/* Description Box */}
						<div className="space-y-4">
							<h3 className="text-md font-semibold font-serif tracking-tight">
								Connects with your favorite development tools
							</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Your workflow is where real work happens. Deus connects with the
								tools that power development—code generation, review,
								deployment, databases, monitoring, version control. Rather than
								adding another interface to juggle, it enhances your existing
								stack.
							</p>
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
										Deus is an intelligent orchestrator and router that connects
										you with the best AI agents for any task. It automatically
										routes your requests to specialized agents for coding
										(Codex, Claude, CodeRabbit), task management (Linear),
										version control (GitHub), and more. We're continuously
										expanding to support agents for finance, legal, and other
										domains.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-1">
									<AccordionTrigger className="text-left">
										How does Deus decide which agent to use?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Deus uses advanced routing logic to analyze your request and
										determine the most appropriate agent. For code reviews, it
										might route to CodeRabbit. For complex implementations, it
										might use Claude or Codex. For task creation, it routes to
										Linear. You can also manually specify which agent you'd like
										to use.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-2">
									<AccordionTrigger className="text-left">
										Which agents and integrations does Deus support?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Deus currently supports coding agents (Codex, Claude,
										CodeRabbit), development tools (GitHub, Lightfast Cloud),
										and task management (Linear). We're actively expanding to
										include agents for finance, legal, and other business
										workflows. New integrations are added regularly based on
										user demand.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-3">
									<AccordionTrigger className="text-left">
										Can I use Deus with my existing workflows?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Yes! Deus integrates seamlessly with your existing tools.
										Connect your GitHub repositories, Linear workspace, and
										other services. Deus will automatically route tasks to the
										appropriate agents, whether it's reviewing PRs, creating
										tasks, or handling other workflow automation.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-4">
									<AccordionTrigger className="text-left">
										How much does Deus cost?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Deus is currently in early access. Pricing will be announced
										soon. Join our waitlist to be notified when we launch and
										get early access pricing.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-5">
									<AccordionTrigger className="text-left">
										Is Deus suitable for teams?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Absolutely! Deus is built for teams and organizations. It
										supports organization-based collaboration, shared workflows,
										audit logs, and team-wide agent configurations. Scale your
										AI-assisted workflows across your entire organization—from
										engineering to finance to legal.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-6">
									<AccordionTrigger className="text-left">
										What makes Deus different from using agents directly?
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground">
										Instead of managing multiple agent subscriptions and
										deciding which tool to use for each task, Deus provides a
										single interface that intelligently routes to the best
										agent. It's like having an expert assistant who knows which
										specialist to call for every job—whether that's code,
										finance, legal, or project management.
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
