"use client";

import { cn } from "@/lib/utils";
import { ThinkingAnimation } from "./thinking-animation";

interface ThinkingMessageProps {
	status: "thinking" | "streaming" | "done";
	show: boolean;
	className?: string;
}

export function ThinkingMessage({ status, show, className }: ThinkingMessageProps) {
	if (!show) return null;

	const statusText = {
		thinking: "Thinking",
		streaming: "Streaming",
		done: "Done",
	}[status];

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<ThinkingAnimation />
			<span className="text-xs text-muted-foreground">{statusText}</span>
		</div>
	);
}
