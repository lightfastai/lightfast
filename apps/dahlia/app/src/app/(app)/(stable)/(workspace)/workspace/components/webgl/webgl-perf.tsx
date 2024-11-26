import { memo, useMemo } from "react";
import { usePerf } from "r3f-perf";

import { InfoCard } from "@repo/ui/components/info-card";

// Memoized InfoCard components
export const PerformanceCard = memo(() => {
  const log = usePerf((state) => state.log);

  const perfItems = useMemo(
    () => [
      {
        label: "FPS",
        value: (log?.fps ?? 0).toFixed(1),
      },
      {
        label: "CPU Load",
        value: `${(log?.cpu ?? 0).toFixed(5)}%`,
      },
      {
        label: "GPU Load",
        value: `${(log?.gpu ?? 0).toFixed(5)}%`,
      },
      {
        label: "Memory Usage",
        value: `${(log?.mem ?? 0).toFixed(2)}MB`,
      },
    ],
    [log?.fps, log?.cpu, log?.gpu, log?.mem],
  );

  return <InfoCard title="Performance" items={perfItems} />;
});

export const GLStatsCard = memo(() => {
  const gl = usePerf((state) => state.getReport().gl);
  const glItems = useMemo(
    () => [
      {
        label: "Draw Calls",
        value: gl?.calls ?? 0,
      },
      {
        label: "Triangles",
        value: (gl?.triangles ?? 0).toLocaleString(),
      },
      {
        label: "Points",
        value: (gl?.points ?? 0).toLocaleString(),
      },
      {
        label: "Lines",
        value: (gl?.lines ?? 0).toLocaleString(),
      },
    ],
    [gl?.calls, gl?.triangles, gl?.points, gl?.lines],
  );

  return <InfoCard title="GL Stats" items={glItems} />;
});

export const SystemCard = memo(() => {
  const infos = usePerf((state) => state.infos);
  const systemItems = useMemo(
    () => [
      {
        label: "Renderer",
        value: infos?.renderer ?? "N/A",
      },
      {
        label: "Version",
        value: infos?.version ?? "N/A",
      },
      {
        label: "Vendor",
        value: infos?.vendor ?? "N/A",
      },
    ],
    [infos?.renderer, infos?.version, infos?.vendor],
  );

  return <InfoCard title="System" items={systemItems} />;
});

// Add display names for better debugging
PerformanceCard.displayName = "PerformanceCard";
GLStatsCard.displayName = "GLStatsCard";
SystemCard.displayName = "SystemCard";
