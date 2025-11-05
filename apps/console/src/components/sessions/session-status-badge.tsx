"use client";

import { Badge } from "@repo/ui/components/ui/badge";

type SessionStatus = "active" | "paused" | "completed";

interface SessionStatusBadgeProps {
	status: SessionStatus;
}

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
	const variants = {
		active: {
			variant: "default" as const,
			className: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border-green-500/20",
		},
		paused: {
			variant: "secondary" as const,
			className: "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 border-yellow-500/20",
		},
		completed: {
			variant: "outline" as const,
			className: "text-muted-foreground border-border/50",
		},
	};

	const config = variants[status];
	const label = status.charAt(0).toUpperCase() + status.slice(1);

	return (
		<Badge variant={config.variant} className={config.className}>
			{label}
		</Badge>
	);
}
