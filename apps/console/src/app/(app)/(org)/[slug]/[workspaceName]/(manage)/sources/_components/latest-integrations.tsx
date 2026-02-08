"use client";

import type { ComponentType, SVGProps } from "react";
import { Layers3, Database } from "lucide-react";
import { IntegrationIcons } from "@repo/ui/integration-icons";

interface Integration {
	name: string;
	description: string;
	Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const latestIntegrations: Integration[] = [
	{
		name: "Linear",
		description: "Issue tracking and project management with AI-powered context.",
		Icon: IntegrationIcons.linear,
	},
	{
		name: "Sentry",
		description: "Error monitoring and performance tracking for production insights.",
		Icon: IntegrationIcons.sentry,
	},
	{
		name: "Vercel",
		description: "Deployment correlation with code changes and rollback intelligence.",
		Icon: IntegrationIcons.vercel,
	},
	{
		name: "PostHog",
		description: "Analytics correlation with deployments and feature flag impact analysis.",
		Icon: IntegrationIcons.posthog,
	},
];

export function LatestIntegrations() {
	return (
		<div className="border border-border/60 rounded-sm sticky top-6 bg-card">
			<div className="p-3 space-y-6">
				{/* Header */}
				<div className="flex items-center gap-2">
					<Layers3 className="h-5 w-5 text-muted-foreground" />
					<h3 className="font-semibold text-foreground">Latest Integrations</h3>
				</div>

				{/* Description */}
				<p className="text-sm text-muted-foreground leading-relaxed">
					Explore more integrations to expand your Vercel development experience.
				</p>

				{/* Integrations list */}
				<div className="space-y-3">
					{latestIntegrations.map((integration) => {
						const Icon = integration.Icon;
						return (
							<div
								key={integration.name}
								className="flex items-start gap-3 group cursor-pointer"
							>
								{/* Icon */}
								<div className="flex items-center justify-center w-8 h-8 rounded-sm bg-muted shrink-0 text-sm mt-0.5 p-1.5">
									<Icon className="w-full h-full text-muted-foreground" />
								</div>

								{/* Content */}
								<div className="flex-1 min-w-0">
									<p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
										{integration.name}
									</p>
									<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
										{integration.description}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
