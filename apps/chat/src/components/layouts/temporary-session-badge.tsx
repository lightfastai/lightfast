"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { Timer } from "lucide-react";

interface TemporarySessionButtonProps {
	active: boolean;
	onToggle: () => void;
	className?: string;
	disabled?: boolean;
	tooltip?: string | null;
}

export function TemporarySessionButton({
	active,
	onToggle,
	className,
	disabled = false,
	tooltip,
}: TemporarySessionButtonProps) {
	const defaultMessage = active
		? "Disable temporary chat"
		: "Start temporary chat";
	const ariaLabel = tooltip ?? defaultMessage;
	const tooltipText = tooltip === null ? null : ariaLabel;

	const button = (
		<Button
			type="button"
			variant="ghost"
			aria-pressed={active}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={onToggle}
			className={cn(
				"h-8 w-8 px-0 py-0 flex items-center justify-center",
				active
					? "border border-blue-500/70 text-blue-600 hover:bg-blue-500/10 dark:text-blue-200 dark:border-blue-400"
					: "hover:bg-muted",
				className,
			)}
		>
		<Timer className="h-4 w-4" aria-hidden="true" />
		</Button>
	);

	if (tooltipText === null) {
		return button;
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent side="bottom" align="end">
				{tooltipText}
			</TooltipContent>
		</Tooltip>
	);
}
