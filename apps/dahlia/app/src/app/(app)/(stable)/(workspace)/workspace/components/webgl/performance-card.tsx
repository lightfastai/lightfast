import { memo, useMemo } from "react";
import { usePerf } from "r3f-perf";

import { InfoCard } from "@repo/ui/components/info-card";

import { PerformanceChart } from "./performance-chart";

export const WebGLPerformance = memo(() => {
  const log = usePerf((state) => state.log);

  const perfItems = useMemo(
    () => [
      {
        label: "FPS",
        value: (log?.fps ?? 0).toFixed(1),
      },
      {
        label: "CPU Time",
        value: `${(log?.cpu ?? 0).toFixed(2)}ms`,
      },
      {
        label: "GPU Time",
        value: `${(log?.gpu ?? 0).toFixed(2)}ms`,
      },
      {
        label: "Memory",
        value: `${(log?.mem ?? 0).toFixed(2)}MB`,
      },
    ],
    [log?.fps, log?.cpu, log?.gpu, log?.mem],
  );

  return (
    <div className="flex flex-col gap-4">
      <InfoCard title="Performance" items={perfItems} />
      <PerformanceChart />
    </div>
  );
});

WebGLPerformance.displayName = "WebGLPerformance";
