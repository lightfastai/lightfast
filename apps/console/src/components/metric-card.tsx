"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface MetricCardProps {
	title: string;
	value: string | number;
	description?: string;
	icon: LucideIcon;
	trend?: {
		value: number; // Percentage change
		isPositive?: boolean; // If undefined, will be calculated from value
	};
	badge?: {
		label: string;
		variant?: "default" | "secondary" | "destructive" | "outline";
	};
	className?: string;
}

/**
 * MetricCard Component
 *
 * Displays a metric with optional trend indicator and comparison to previous period.
 * Trend indicators:
 * - ↑ (TrendingUp) for positive changes (green)
 * - ↓ (TrendingDown) for negative changes (red)
 * - → (Minus) for no change (gray)
 */
export function MetricCard({
	title,
	value,
	description,
	icon: Icon,
	trend,
	badge,
	className,
}: MetricCardProps) {
	const getTrendIcon = () => {
		if (!trend) return null;

		const isPositive = trend.isPositive ?? trend.value > 0;
		const isNeutral = trend.value === 0;

		if (isNeutral) {
			return (
				<div className="flex items-center gap-1 text-muted-foreground">
					<Minus className="h-3 w-3" />
					<span className="text-xs font-medium">0%</span>
				</div>
			);
		}

		const TrendIcon = isPositive ? TrendingUp : TrendingDown;
		const colorClass = isPositive
			? "text-green-600 dark:text-green-500"
			: "text-red-600 dark:text-red-500";

		return (
			<div className={cn("flex items-center gap-1", colorClass)}>
				<TrendIcon className="h-3 w-3" />
				<span className="text-xs font-medium">
					{Math.abs(trend.value).toFixed(1)}%
				</span>
			</div>
		);
	};

	return (
		<Card className={cn("transition-all hover:shadow-md", className)}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<Icon className="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div className="flex items-baseline justify-between gap-2">
					<div className="text-2xl font-bold">{value}</div>
					{badge && (
						<Badge variant={badge.variant ?? "default"} className="text-xs">
							{badge.label}
						</Badge>
					)}
				</div>
				<div className="flex items-center justify-between gap-2 mt-1">
					{description && (
						<p className="text-xs text-muted-foreground">{description}</p>
					)}
					{trend && getTrendIcon()}
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * MetricCard Skeleton for loading states
 */
export function MetricCardSkeleton() {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<div className="h-4 w-24 bg-muted animate-pulse rounded" />
				<div className="h-4 w-4 bg-muted animate-pulse rounded" />
			</CardHeader>
			<CardContent>
				<div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
				<div className="h-3 w-32 bg-muted animate-pulse rounded" />
			</CardContent>
		</Card>
	);
}
