import { memo, useMemo } from "react";
import { usePerf } from "r3f-perf";

import { InfoCard } from "@repo/ui/components/info-card";

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

SystemCard.displayName = "SystemCard";
