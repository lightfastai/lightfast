"use client";

import React from "react";
import {
	Sparkles,
	Code2,
	Workflow,
	Bot,
	GitBranch,
	BookOpen,
	Stars,
} from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";

interface Integration {
	id: string;
	name: string;
	tagline: string;
	description: string;
	highlights: string[];
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const integrations: Integration[] = [
	{
		id: "claude-code",
		name: "Claude Code",
		tagline: "Anthropic's pair programmer for deep refactors.",
		description:
			"Dispatch complex implementation work to Claude Code and get iterative edits without leaving Deus.",
		highlights: [
			"Understands large repositories and multi-file diffs",
			"Great for refactors, tests, and explaining code",
			"Keeps conversational context across sessions",
		],
		icon: Sparkles,
	},
	{
		id: "codex",
		name: "Codex",
		tagline: "Rapid generation from OpenAI's coding model.",
		description:
			"Ask Codex to draft functions, scripts, and boilerplate, then review or reroute as needed.",
		highlights: [
			"Generates starter implementations in seconds",
			"Understands instructions and inline examples",
			"Pairs well with CodeRabbit for review",
		],
		icon: Code2,
	},
	{
		id: "linear",
		name: "Linear",
		tagline: "Sync tasks with your product roadmap.",
		description:
			"Create, update, and triage Linear issues straight from Deus conversations or automations.",
		highlights: [
			"Turn AI insights into actionable tickets",
			"Keep status and assignees in sync automatically",
			"Log routing decisions for auditability",
		],
		icon: Workflow,
	},
	{
		id: "coderabbit",
		name: "CodeRabbit",
		tagline: "Automated PR reviews with pragmatic feedback.",
		description:
			"Route pull requests to CodeRabbit for inline comments and merge readiness scores.",
		highlights: [
			"Surfaces risky changes with suggested fixes",
			"Understands project conventions and test coverage",
			"Feeds review context back into Deus",
		],
		icon: Bot,
	},
	{
		id: "github",
		name: "GitHub",
		tagline: "Bring repos, branches, and PRs into Deus.",
		description:
			"Connect GitHub to grant agents real repository context and automate branch workflows.",
		highlights: [
			"Stream commits and discussions into conversations",
			"Trigger agents from PR events or checks",
			"Granular scopes keep access secure",
		],
		icon: GitBranch,
	},
	{
		id: "notion",
		name: "Notion",
		tagline: "Reference specs and docs instantly.",
		description:
			"Deus agents can search Notion workspaces to ground answers in the docs your team trusts.",
		highlights: [
			"Semantic search across product specs and RFCs",
			"Keep documentation in sync with latest changes",
			"Respect workspace permissions by default",
		],
		icon: BookOpen,
	},
	{
		id: "gemini-code",
		name: "Gemini Code",
		tagline: "Google's reasoning model for multi-step coding.",
		description:
			"Escalate analytical tasks to Gemini Code when you need multi-step reasoning or multimodal context.",
		highlights: [
			"Handles architectural questions and design tradeoffs",
			"Supports multimodal inputs for diagrams and snippets",
			"Returns structured plans ready for execution",
		],
		icon: Stars,
	},
];

export function DeusIntegrationsSection() {
	const [activeId, setActiveId] = React.useState(integrations[0]?.id ?? "");
	const activeIntegration = integrations.find((integration) => integration.id === activeId);

	if (!activeIntegration) {
		return null;
	}

	const ActiveIcon = activeIntegration.icon;

	return (
		<section className="bg-background py-20 sm:py-24 lg:py-32 page-gutter-sm">
			<div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl space-y-12">
				<div className="space-y-3 text-left">
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
						Integrations
					</p>
					<h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground">
						Deus connects to the tools your team already uses
					</h2>
					<p className="max-w-2xl text-sm sm:text-base text-muted-foreground">
						Route work between AI agents and the systems you rely on. Switch contexts without leaving Deus.
					</p>
				</div>

				<div className="grid gap-8 lg:grid-cols-[320px_1fr]">
					<div className="flex flex-col gap-2">
						{integrations.map((integration) => {
							const Icon = integration.icon;
							return (
								<Button
									key={integration.id}
									variant={activeId === integration.id ? "secondary" : "ghost"}
									className="h-auto justify-start gap-3 rounded-lg border border-border/40 px-4 py-3 text-left"
									onClick={() => setActiveId(integration.id)}
								>
									<span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
										<Icon className="h-4 w-4 text-foreground" />
									</span>
									<span className="flex flex-col">
										<span className="font-semibold text-sm text-foreground">
											{integration.name}
										</span>
										<span className="text-xs text-muted-foreground">
											{integration.tagline}
										</span>
									</span>
								</Button>
							);
						})}
					</div>

					<div className="rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm p-6 sm:p-8">
						<div className="flex items-center gap-3">
							<span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
								<ActiveIcon className="h-6 w-6 text-primary" />
							</span>
							<div>
								<h3 className="font-serif text-2xl text-foreground">
									{activeIntegration.name}
								</h3>
								<p className="text-sm text-muted-foreground">
									{activeIntegration.tagline}
								</p>
							</div>
						</div>

						<p className="mt-6 text-sm sm:text-base leading-relaxed text-muted-foreground">
							{activeIntegration.description}
						</p>

						<ul className="mt-6 space-y-3 text-sm text-muted-foreground">
							{activeIntegration.highlights.map((highlight) => (
								<li key={highlight} className="flex items-start gap-2">
									<span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
									<span>{highlight}</span>
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</section>
	);
}
