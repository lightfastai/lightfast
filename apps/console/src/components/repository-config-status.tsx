"use client";

import { FileText, Settings, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";

export type ConfigStatus = "configured" | "unconfigured" | "ingesting" | "error" | "pending";

interface RepositoryConfigStatusProps {
	status: ConfigStatus;
	documentCount?: number;
	lastIngestedAt?: Date | string;
	onSetup?: () => void;
	onRetry?: () => void;
}

/**
 * Repository Configuration Status Indicator
 *
 * Shows the current configuration and indexing status for a repository.
 * Displays appropriate badges, document counts, and action buttons.
 */
export function RepositoryConfigStatus({
	status,
	documentCount,
	onSetup,
	onRetry,
}: RepositoryConfigStatusProps) {
	const getStatusDisplay = () => {
		switch (status) {
			case "configured":
				return {
					icon: <FileText className="h-3.5 w-3.5" />,
					badge: (
						<Badge variant="secondary" className="gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400">
							<Check className="h-3 w-3" />
							Configured
						</Badge>
					),
					details: documentCount !== undefined && documentCount > 0 ? (
						<span className="text-xs text-muted-foreground">
							{documentCount} {documentCount === 1 ? "document" : "documents"} indexed
						</span>
					) : null,
					action: null,
				};

			case "unconfigured":
				return {
					icon: <Settings className="h-3.5 w-3.5" />,
					badge: (
						<Badge variant="secondary" className="gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400">
							<Settings className="h-3 w-3" />
							Setup needed
						</Badge>
					),
					details: (
						<span className="text-xs text-muted-foreground">
							No configuration detected
						</span>
					),
					action: onSetup ? (
						<Button
							variant="outline"
							size="sm"
							onClick={onSetup}
							className="h-7 gap-1.5 text-xs"
						>
							<Settings className="h-3 w-3" />
							Setup
						</Button>
					) : null,
				};

			case "ingesting":
				return {
					icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
					badge: (
						<Badge variant="secondary" className="gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400">
							<Loader2 className="h-3 w-3 animate-spin" />
							Ingesting
						</Badge>
					),
					details: (
						<span className="text-xs text-muted-foreground">
							First ingestion in progress...
						</span>
					),
					action: null,
				};

			case "error":
				return {
					icon: <AlertCircle className="h-3.5 w-3.5" />,
					badge: (
						<Badge variant="secondary" className="gap-1.5 bg-red-500/10 text-red-600 dark:text-red-400">
							<AlertCircle className="h-3 w-3" />
							Error
						</Badge>
					),
					details: (
						<span className="text-xs text-muted-foreground">
							Configuration error
						</span>
					),
					action: onRetry ? (
						<Button
							variant="outline"
							size="sm"
							onClick={onRetry}
							className="h-7 gap-1.5 text-xs"
						>
							Retry
						</Button>
					) : null,
				};

			case "pending":
			default:
				return {
					icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
					badge: (
						<Badge variant="secondary" className="gap-1.5">
							<Loader2 className="h-3 w-3 animate-spin" />
							Checking
						</Badge>
					),
					details: (
						<span className="text-xs text-muted-foreground">
							Checking configuration...
						</span>
					),
					action: null,
				};
		}
	};

	const { badge, details, action } = getStatusDisplay();

	return (
		<div className="flex items-center gap-3">
			{badge}
			{details && <div className="flex-1">{details}</div>}
			{action}
		</div>
	);
}
