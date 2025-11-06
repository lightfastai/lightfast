"use client";

import type { ComponentType, SVGProps } from "react";
import { useEffect, useState } from "react";
import {
	Sparkles,
	Code2,
	Kanban,
	Bot,
	GitBranch,
	BookOpen,
	Stars,
} from "lucide-react";

interface IntegrationItem {
	name: string;
	Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const integrations: IntegrationItem[] = [
	{ name: "Claude Code", Icon: Sparkles },
	{ name: "Codex", Icon: Code2 },
	{ name: "Linear", Icon: Kanban },
	{ name: "CodeRabbit", Icon: Bot },
	{ name: "GitHub", Icon: GitBranch },
	{ name: "Notion", Icon: BookOpen },
	{ name: "Gemini Code", Icon: Stars },
];

export function DeusIntegrationShowcase() {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [hovered, setHovered] = useState<string | null>(null);
	const [isHovering, setIsHovering] = useState(false);

	useEffect(() => {
		if (!isHovering && !hovered) {
			const interval = setInterval(() => {
				setCurrentIndex((prev) => (prev + 1) % integrations.length);
			}, 2200);

			return () => clearInterval(interval);
		}
	}, [isHovering, hovered]);

	const scrollItems = [...integrations, ...integrations, ...integrations];
	const fallbackName = integrations[currentIndex]?.name ?? integrations[0]?.name ?? "Claude Code";

	return (
		<div className="w-full space-y-6">
			<div className="text-left">
				<h2 className="text-lg sm:text-xl lg:text-2xl font-semibold">
					<span className="text-muted-foreground">Console works with </span>
					<span className="text-foreground inline-flex min-w-[140px] items-center gap-2">
						{hovered ?? fallbackName}
					</span>
				</h2>
			</div>

			<div
				className="relative w-full overflow-hidden py-4"
				onMouseEnter={() => setIsHovering(true)}
				onMouseLeave={() => {
					setIsHovering(false);
					setHovered(null);
				}}
			>
				<div
					className="flex animate-framework-scroll"
					style={{ animationPlayState: isHovering ? "paused" : "running" }}
				>
					{scrollItems.map((item, index) => {
						const originalIndex = index % integrations.length;
						const FrameworkIcon = integrations[originalIndex]?.Icon ?? Sparkles;

						return (
							<div
								key={`${item.name}-${index}`}
								className="flex-shrink-0 px-6 lg:px-8"
								onMouseEnter={() => setHovered(integrations[originalIndex]?.name ?? null)}
								onMouseLeave={() => setHovered(null)}
							>
								<div
									className={`flex items-center gap-3 rounded-md border border-transparent px-4 py-2 transition-all duration-200 ${
										hovered === integrations[originalIndex]?.name ? "border-border/60 bg-muted/30" : ""
									}`}
								>
									<span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
										<FrameworkIcon className="h-4 w-4" />
									</span>
									<span className={`text-base font-medium ${hovered === integrations[originalIndex]?.name ? "text-foreground" : "text-muted-foreground"}`}>
										{integrations[originalIndex]?.name ?? item.name}
									</span>
								</div>
							</div>
						);
					})}
				</div>
				<div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
				<div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
			</div>
		</div>
	);
}
