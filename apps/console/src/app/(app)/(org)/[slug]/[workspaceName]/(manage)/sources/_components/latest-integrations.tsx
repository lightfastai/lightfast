"use client";

import type { ComponentType, SVGProps } from "react";
import { Icons } from "@repo/ui/components/icons";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";

interface Integration {
	name: string;
	description: string;
	Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const latestIntegrations: Integration[] = [
	{
		name: "Linear",
		description: "Issue tracking and project management with AI-powered context.",
		Icon: IntegrationLogoIcons.linear,
	},
	{
		name: "Sentry",
		description: "Error monitoring and performance tracking for production insights.",
		Icon: IntegrationLogoIcons.sentry,
	},
	{
		name: "Vercel",
		description: "Deployment correlation with code changes and rollback intelligence.",
		Icon: IntegrationLogoIcons.vercel,
	},
	{
		name: "PostHog",
		description: "Analytics correlation with deployments and feature flag impact analysis.",
		Icon: IntegrationLogoIcons.posthog,
	},
];

export function LatestIntegrations() {
	return (
		<div className="relative sticky top-6 rounded-md p-3 pb-7 space-y-4">
			{/* Glass backdrop layer */}
			<div className="absolute inset-0 rounded-md bg-card/40 border border-border/50 backdrop-blur-md -z-10" />

			{/* Header */}
			<div className="flex items-center gap-2">
				<Icons.logoShort className="h-3 w-3 text-foreground/60" />
				<h3 className="text-sm font-medium text-foreground">Latest Integrations</h3>
			</div>

			{/* Description */}
			<p className="text-xs text-muted-foreground leading-relaxed">
				Explore more integrations to expand your development experience.
			</p>

			{/* Integrations list */}
			<div className="space-y-1">
				{latestIntegrations.map((integration) => {
					const Icon = integration.Icon;
					return (
						<div
							key={integration.name}
							className="flex items-center gap-3 py-1.5"
						>
							{/* Icon */}
							<div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted/60 shrink-0 p-1.5">
								<Icon className="w-full h-full text-foreground/60" />
							</div>

							{/* Content */}
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-foreground/80">
									{integration.name}
								</p>
								<p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
									{integration.description}
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
