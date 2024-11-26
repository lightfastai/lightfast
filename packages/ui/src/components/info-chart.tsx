"use client";

import { memo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "./ui/card";
import { ChartContainer } from "./ui/chart";

export interface DataPoint {
  timestamp: number;
  [key: string]: number;
}

export interface ChartMetric {
  key: string;
  label: string;
  color: string;
}

export interface InfoChartProps {
  /** Array of data points to display */
  data: DataPoint[];
  /** Configuration for each metric line */
  metrics: ChartMetric[];
  /** Maximum number of data points to show */
  maxDataPoints?: number;
  /** Y-axis configuration */
  yAxis?: {
    min?: number;
    max?: number;
    /** Function to format Y-axis tick values */
    tickFormatter?: (value: number) => string;
    /** Fixed tick values to show */
    ticks?: number[];
    /** Unit to display (e.g., "ms", "%") */
    unit?: string;
  };
  /** Chart height in pixels */
  height?: number;
  /** Optional className for the Card component */
  className?: string;
}

export const InfoChart = memo<InfoChartProps>(
  ({
    data,
    metrics,
    maxDataPoints = 100,
    yAxis = {},
    height = 200,
    className,
  }) => {
    const {
      min = 0,
      max,
      tickFormatter = (value) => `${value.toFixed(2)}${yAxis.unit ?? ""}`,
      ticks,
    } = yAxis;

    // Create chart config for the ChartContainer
    const chartConfig = metrics.reduce(
      (acc, metric) => {
        acc[metric.key] = {
          label: metric.label,
          color: metric.color,
        };
        return acc;
      },
      {} as Record<string, { label: string; color: string }>,
    );

    // Limit data points
    const displayData = data.slice(-maxDataPoints);

    return (
      <Card className={className}>
        <CardContent className="p-4">
          <ChartContainer config={chartConfig}>
            <LineChart
              data={displayData}
              height={height}
              margin={{
                top: 5,
                right: 5,
                left: 5,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["auto", "auto"]}
                tickFormatter={() => ""}
                hide
              />
              <YAxis
                domain={[min, max ?? "auto"]}
                tickFormatter={tickFormatter}
                width={50}
                ticks={ticks}
              />
              <CartesianGrid
                horizontal={false}
                vertical={true}
                strokeDasharray="3 3"
                opacity={0.3}
              />
              {metrics.map((metric) => (
                <Line
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  },
);

InfoChart.displayName = "InfoChart";
