"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { usePerf } from "r3f-perf";

import type { DataPoint} from "@repo/ui/components/info-chart";
import { InfoChart } from "@repo/ui/components/info-chart";

interface PerfDataPoint extends DataPoint {
  cpu: number;
  gpu: number;
}

const MAX_DATA_POINTS = 100;
const TARGET_FRAME_TIME = 16.67; // 60 FPS target
const MIN_SCALE = 1; // Minimum scale of 1ms

const metrics = [
  {
    key: "cpu",
    label: "CPU Time",
    color: "hsl(var(--chart-1))",
  },
  {
    key: "gpu",
    label: "GPU Time",
    color: "hsl(var(--chart-2))",
  },
];

export const PerformanceChart = memo(() => {
  const [data, setData] = useState<PerfDataPoint[]>([]);
  const log = usePerf((state) => state.log);

  const updateData = useCallback(() => {
    setData((prevData) => {
      const newPoint = {
        timestamp: Date.now(),
        cpu: log?.cpu ?? 0,
        gpu: log?.gpu ?? 0,
      };

      const updatedData = [...prevData, newPoint];
      if (updatedData.length > MAX_DATA_POINTS) {
        updatedData.shift();
      }
      return updatedData;
    });
  }, [log]);

  useEffect(() => {
    const interval = setInterval(updateData, 25);
    return () => clearInterval(interval);
  }, [updateData]);

  // Calculate a more appropriate Y-axis scale
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.cpu, d.gpu)),
    MIN_SCALE,
  );

  // Set the upper bound to either:
  // - 2x the current max value (for small values)
  // - or the target frame time (for larger values)
  // whichever is smaller
  const upperBound = Math.min(
    Math.max(maxValue * 2, MIN_SCALE),
    TARGET_FRAME_TIME,
  );

  return (
    <InfoChart
      data={data}
      metrics={metrics}
      maxDataPoints={MAX_DATA_POINTS}
      yAxis={{
        min: 0,
        max: upperBound,
        tickFormatter: (value) => `${value.toFixed(2)}ms`,
        ticks: [
          0,
          upperBound / 4,
          upperBound / 2,
          (upperBound * 3) / 4,
          upperBound,
        ],
        unit: "ms",
      }}
      className="w-full"
    />
  );
});

PerformanceChart.displayName = "PerformanceChart";
