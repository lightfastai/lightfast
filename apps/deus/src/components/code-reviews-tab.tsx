"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";

interface CodeReviewsTabProps {
	orgId: number;
}

// Mock data for now - will be replaced with real data from API
const MOCK_REVIEWS = [
	{
		id: "1",
		repositoryName: "lightfastai/lightfast",
		pullRequestNumber: 189,
		pullRequestTitle:
			"feat(deus): add Clerk auth and simplified repository connection",
		status: "completed" as const,
		triggeredAt: "2024-10-07T14:30:00Z",
		bugCount: 2,
		severity: "warning" as const,
	},
	{
		id: "2",
		repositoryName: "lightfastai/lightfast",
		pullRequestNumber: 188,
		pullRequestTitle: "feat: add Deus app - AI workflow orchestration platform",
		status: "completed" as const,
		triggeredAt: "2024-10-07T12:15:00Z",
		bugCount: 1,
		severity: "warning" as const,
	},
	{
		id: "3",
		repositoryName: "lightfastai/lightfast",
		pullRequestNumber: 186,
		pullRequestTitle:
			"feat(chat): Implement Vercel Blob-based attachment system with comprehensive ...",
		status: "completed" as const,
		triggeredAt: "2024-10-01T12:15:00Z",
		bugCount: 1,
		severity: "severe" as const,
	},
];

const STATUS_CONFIG = {
	pending: {
		icon: Clock,
		color: "text-muted-foreground",
	},
	running: {
		icon: Clock,
		color: "text-blue-500",
	},
	completed: {
		icon: CheckCircle2,
		color: "text-green-500",
	},
	failed: {
		icon: XCircle,
		color: "text-destructive",
	},
};

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

export function CodeReviewsTab({ orgId }: CodeReviewsTabProps) {
	const [reviews] = useState(MOCK_REVIEWS);

	if (reviews.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<p className="text-sm text-muted-foreground">No code reviews yet</p>
			</div>
		);
	}

	return (
		<div className="space-y-0">
			{reviews.map((review, index) => {
				const statusConfig = STATUS_CONFIG[review.status];
				const StatusIcon = statusConfig.icon;

				return (
					<div
						key={review.id}
						className={`group flex items-center gap-4 py-2 px-4 -mx-4 hover:bg-muted/50 transition-colors ${
							index !== reviews.length - 1 ? "border-b border-border/40" : ""
						}`}
					>
						<div className="flex-1 min-w-0">
							<h3 className="text-sm font-medium mb-1 truncate">
								{review.pullRequestTitle}
							</h3>
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span>{formatDate(review.triggeredAt)}</span>
								<span>·</span>
								<span className="font-mono">{review.repositoryName}</span>
								<span>·</span>
								<span>refs/pull/{review.pullRequestNumber}/head</span>
							</div>
						</div>

						<div className="flex items-center gap-3 shrink-0">
							{review.bugCount > 0 && (
								<Badge
									variant={
										review.severity === "severe" ? "destructive" : "secondary"
									}
									className="gap-1.5 font-normal"
								>
									<AlertCircle className="h-3 w-3" />
									{review.bugCount} {review.bugCount === 1 ? "bug" : "bugs"}
									{review.severity === "severe" && " (severe)"}
								</Badge>
							)}
							<Button variant="outline" size="sm" className="h-8 px-3">
								Fix
							</Button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
