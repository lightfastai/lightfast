"use client";

import { memo } from "react";
import { cn } from "@repo/ui/lib/utils";

interface SineWaveDotsProps {
	className?: string;
}

export const SineWaveDots = memo(function SineWaveDots({
	className,
}: SineWaveDotsProps) {
	return (
		<div
			className={cn(
				"bg-background border border-muted/30 rounded-xl px-3 py-2 inline-flex items-center gap-1",
				className,
			)}
		>
			<div className="flex items-center gap-1">
				{[0, 1, 2].map((index) => (
					<div
						key={index}
						className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-sine-wave"
						style={{
							animationDelay: `${index * 0.2}s`,
						}}
					/>
				))}
			</div>
		</div>
	);
});