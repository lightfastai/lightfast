"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TooltipProps } from "recharts";
import { Clock, TrendingUp } from "lucide-react";
import { formatDuration } from "../lib/performance-utils";
import type { JobPercentiles, PerformanceTimeSeries } from "~/types";

interface PerformanceMetricsProps {
	percentiles: JobPercentiles;
	timeSeries: PerformanceTimeSeries;
}

export function PerformanceMetrics({
	percentiles,
	timeSeries,
}: PerformanceMetricsProps) {

	// Prepare chart data
	const chartData = timeSeries.map((point) => ({
		hour: point.hour,
		jobs: point.jobCount,
		avgDuration: point.avgDuration / 1000, // Convert to seconds for readability
	}));

	// Custom tooltip for the chart
	const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
		if (!active || !payload?.[0]) return null;

		const data = payload[0].payload as { hour: string; jobs: number; avgDuration: number };
		return (
			<div className="rounded-lg border bg-background p-3 shadow-md">
				<p className="text-xs font-medium text-muted-foreground mb-2">
					{data.hour}
				</p>
				<div className="space-y-1">
					<p className="text-sm">
						<span className="font-medium">{data.jobs}</span> jobs
					</p>
					<p className="text-sm">
						<span className="font-medium">
							{formatDuration(data.avgDuration * 1000)}
						</span>{" "}
						avg duration
					</p>
				</div>
			</div>
		);
	};

	const hasData = percentiles.hasData;

	return (
		<Card className="border-border/60">
			<CardHeader className="flex flex-row items-center justify-between pb-3">
				<div className="space-y-1">
					<CardTitle className="text-base font-medium">
						Performance Metrics
					</CardTitle>
					<p className="text-xs text-muted-foreground">
						Job execution times over the last 24 hours
					</p>
				</div>
				<TrendingUp className="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent className="space-y-6">
				{!hasData ? (
					<div className="text-center py-12 text-sm text-muted-foreground">
						<Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p>No job data available yet</p>
						<p className="text-xs mt-1">
							Performance metrics will appear after jobs complete
						</p>
					</div>
				) : (
					<>
						{/* Percentile Badges */}
						<div className="flex items-center gap-3 flex-wrap">
							<PercentileBadge
								label="p50"
								value={percentiles.p50}
								description="50% of jobs"
							/>
							<PercentileBadge
								label="p95"
								value={percentiles.p95}
								description="95% of jobs"
							/>
							<PercentileBadge
								label="p99"
								value={percentiles.p99}
								description="99% of jobs"
							/>
							<PercentileBadge
								label="max"
								value={percentiles.max}
								description="Slowest job"
								variant="outline"
							/>
						</div>

						{/* Time Series Chart */}
						<div className="space-y-2">
							<p className="text-xs font-medium text-muted-foreground">
								Jobs Over Time
							</p>
							<ResponsiveContainer width="100%" height={200}>
								<AreaChart data={chartData}>
									<defs>
										<linearGradient id="jobGradient" x1="0" y1="0" x2="0" y2="1">
											<stop
												offset="5%"
												stopColor="hsl(var(--primary))"
												stopOpacity={0.3}
											/>
											<stop
												offset="95%"
												stopColor="hsl(var(--primary))"
												stopOpacity={0}
											/>
										</linearGradient>
									</defs>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="hsl(var(--border))"
										opacity={0.3}
									/>
									<XAxis
										dataKey="hour"
										tick={{ fontSize: 11 }}
										tickLine={false}
										axisLine={false}
										stroke="hsl(var(--muted-foreground))"
									/>
									<YAxis
										tick={{ fontSize: 11 }}
										tickLine={false}
										axisLine={false}
										stroke="hsl(var(--muted-foreground))"
										width={30}
									/>
									<Tooltip content={<CustomTooltip />} />
									<Area
										type="monotone"
										dataKey="jobs"
										stroke="hsl(var(--primary))"
										strokeWidth={2}
										fill="url(#jobGradient)"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

interface PercentileBadgeProps {
	label: string;
	value: number;
	description: string;
	variant?: "default" | "outline";
}

function PercentileBadge({
	label,
	value,
	description,
	variant = "default",
}: PercentileBadgeProps) {
	return (
		<div className="flex items-center gap-2">
			<Badge variant={variant} className="text-xs px-2 py-1 font-mono">
				{label}
			</Badge>
			<div className="flex flex-col">
				<span className="text-sm font-semibold">{formatDuration(value)}</span>
				<span className="text-xs text-muted-foreground">{description}</span>
			</div>
		</div>
	);
}
