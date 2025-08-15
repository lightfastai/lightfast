import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface TemplateCardProps {
	title: string;
	description: string;
	icons: React.ReactNode[];
	href?: string;
}

export function TemplateCard({
	title,
	description,
	icons,
	href = "#",
}: TemplateCardProps) {
	return (
		<div className="group relative rounded-sm border border-border/30 bg-muted/10 overflow-hidden backdrop-blur-sm hover:border-border transition-all duration-200">
			{/* Top Section - Icons */}
			<div className="flex items-center bg-background justify-center gap-3 py-12 border-b border-border/50">
				{icons.map((icon, index) => (
					<div
						key={index}
						className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50"
					>
						{icon}
					</div>
				))}
			</div>

			{/* Bottom Section - Content */}
			<div className="p-6 flex flex-col">
				<h3 className="mb-3 text-lg font-semibold text-foreground">{title}</h3>
				<p className="mb-6 text-sm text-muted-foreground/80 leading-relaxed flex-grow">
					{description}
				</p>

				{/* View Template Link - Bottom Left */}
				<Link
					href={href}
					className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group self-start"
				>
					<span>View Template</span>
					<ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
				</Link>
			</div>
		</div>
	);
}

