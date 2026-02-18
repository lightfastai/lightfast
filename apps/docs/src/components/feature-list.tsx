interface FeatureListProps {
	title?: string;
	features: string[];
	className?: string;
}

export function FeatureList({ title, features, className = "" }: FeatureListProps) {
	return (
		<div className={`border-l-4 border-primary pl-6 py-2 ${className}`}>
			{title && (
				<h3 className="text-lg font-semibold text-foreground mb-4">
					{title}
				</h3>
			)}
			<div className="space-y-3">
				{features.map((feature) => (
					<p
						key={feature}
						className="text-muted-foreground leading-relaxed"
					>
						{feature}
					</p>
				))}
			</div>
		</div>
	);
}
