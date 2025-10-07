import type { ReactNode } from "react";

interface FeatureCardProps {
	icon: ReactNode;
	title: string;
	description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
	return (
		<div className="relative rounded-lg border border-border/50 bg-card p-6 hover:border-border transition-colors">
			<div className="mb-4 text-muted-foreground">{icon}</div>
			<h3 className="mb-2 font-semibold text-base">{title}</h3>
			<p className="text-sm text-muted-foreground">{description}</p>
		</div>
	);
}
