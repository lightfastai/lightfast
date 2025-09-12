"use client";

import { memo } from "react";
import { cn } from "@repo/ui/lib/utils";

interface SineWaveDotsProps {
	className?: string;
}

// Static data to prevent recreation on each render
const DOTS = [
	{ key: 0, delay: "0s" },
	{ key: 1, delay: "0.2s" }, 
	{ key: 2, delay: "0.4s" },
] as const;

export const SineWaveDots = memo(function SineWaveDots({
	className,
}: SineWaveDotsProps) {
	return (
		<div className={cn("px-3 py-3 inline-flex items-center gap-1", className)}>
			<div className="flex items-center gap-1.5">
				{DOTS.map(({ key, delay }) => (
					<div
						key={key}
						className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-sine-wave"
						style={{ animationDelay: delay }}
					/>
				))}
			</div>
		</div>
	);
});
