"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Clock, TrendingUp } from "lucide-react";
import type { TooltipProps } from "recharts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { JobPercentiles, PerformanceTimeSeries } from "~/types";
import { formatDuration } from "../lib/performance-utils";

interface PerformanceMetricsProps {
  percentiles: JobPercentiles;
  timeSeries: PerformanceTimeSeries;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!(active && payload?.[0])) {
    return null;
  }

  const data = payload[0].payload as {
    hour: string;
    jobs: number;
    avgDuration: number;
  };
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-2 font-medium text-muted-foreground text-xs">
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
}

export function PerformanceMetrics({
  percentiles,
  timeSeries,
}: PerformanceMetricsProps) {
  const chartData = timeSeries.map((point) => ({
    hour: point.hour,
    jobs: point.jobCount,
    avgDuration: point.avgDuration / 1000,
  }));

  const hasData = percentiles.hasData;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-1">
          <CardTitle className="font-medium text-base">
            Performance Metrics
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Job execution times over the last 24 hours
          </p>
        </div>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-6">
        {hasData ? (
          <>
            {/* Percentile Badges */}
            <div className="flex flex-wrap items-center gap-3">
              <PercentileBadge
                description="50% of jobs"
                label="p50"
                value={percentiles.p50}
              />
              <PercentileBadge
                description="95% of jobs"
                label="p95"
                value={percentiles.p95}
              />
              <PercentileBadge
                description="99% of jobs"
                label="p99"
                value={percentiles.p99}
              />
              <PercentileBadge
                description="Slowest job"
                label="max"
                value={percentiles.max}
                variant="outline"
              />
            </div>

            {/* Time Series Chart */}
            <div className="space-y-2">
              <p className="font-medium text-muted-foreground text-xs">
                Jobs Over Time
              </p>
              <ResponsiveContainer height={200} width="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="jobGradient"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
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
                    opacity={0.3}
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    axisLine={false}
                    dataKey="hour"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    dataKey="jobs"
                    fill="url(#jobGradient)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-muted-foreground text-sm">
            <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No job data available yet</p>
            <p className="mt-1 text-xs">
              Performance metrics will appear after jobs complete
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PercentileBadgeProps {
  description: string;
  label: string;
  value: number;
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
      <Badge className="px-2 py-1 font-mono text-xs" variant={variant}>
        {label}
      </Badge>
      <div className="flex flex-col">
        <span className="font-semibold text-sm">{formatDuration(value)}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </div>
    </div>
  );
}
