"use client";

import { Card } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	Database,
	FileText,
	Box,
	TrendingUp,
	Clock,
	Activity,
	ArrowUp,
	ArrowDown,
	Minus,
} from "lucide-react";

interface KeyMetricsStripProps {
	sourcesCount: number;
	totalDocuments: number;
	totalChunks: number;
	successRate: number;
	avgDurationMs: number;
	recentJobsCount: number;
}

export function KeyMetricsStrip({
	sourcesCount,
	totalDocuments,
	totalChunks,
	successRate,
	avgDurationMs,
	recentJobsCount,
}: KeyMetricsStripProps) {
	const formatDuration = (ms: number) => {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
	};

	const getTrendIcon = (value: number, threshold: number, inverse = false) => {
		if (value > threshold) {
			return inverse ? (
				<ArrowDown className="h-3 w-3 text-red-500" />
			) : (
				<ArrowUp className="h-3 w-3 text-green-500" />
			);
		}
		if (value < threshold * 0.9) {
			return inverse ? (
				<ArrowUp className="h-3 w-3 text-green-500" />
			) : (
				<ArrowDown className="h-3 w-3 text-red-500" />
			);
		}
		return <Minus className="h-3 w-3 text-muted-foreground" />;
	};

	const metrics = [
		{
			label: "Connected Sources",
			value: sourcesCount,
			icon: Database,
			trend: null,
		},
		{
			label: "Documents",
			value: totalDocuments.toLocaleString(),
			icon: FileText,
			trend: null,
		},
		{
			label: "Chunks",
			value: totalChunks.toLocaleString(),
			icon: Box,
			trend: null,
		},
		{
			label: "Success Rate",
			value: recentJobsCount === 0 ? "—" : `${successRate.toFixed(0)}%`,
			icon: TrendingUp,
			trend: recentJobsCount > 0 ? getTrendIcon(successRate, 95) : null,
			badge:
				recentJobsCount > 0 && successRate >= 95 ? (
					<Badge variant="default" className="text-[10px] px-1 py-0 h-4">
						Healthy
					</Badge>
				) : null,
		},
		{
			label: "Avg Duration",
			value: recentJobsCount === 0 ? "—" : formatDuration(avgDurationMs),
			icon: Clock,
			trend: null,
		},
		{
			label: "Recent Jobs",
			value: recentJobsCount,
			icon: Activity,
			trend: null,
		},
	];

	return (
		<Card className="border-border/60">
			<div className="p-4">
				<div className="grid grid-cols-6 gap-4">
					{metrics.map((metric, index) => {
						const Icon = metric.icon;
						return (
							<div key={index} className="space-y-1">
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Icon className="h-3 w-3" />
									<span>{metric.label}</span>
								</div>
								<div className="flex items-baseline gap-2">
									<div className="text-2xl font-bold">{metric.value}</div>
									{metric.trend}
									{metric.badge}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</Card>
	);
}
