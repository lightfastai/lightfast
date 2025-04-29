import { memo, useMemo } from "react";
import { usePerf } from "r3f-perf";

import { InfoCard } from "@repo/ui/components/info-card";

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

GLStatsCard.displayName = "GLStatsCard";
