import { useEffect, useState } from "react";
import type { SettingsSnapshot } from "../../../../shared/ipc";

export function useSettingsSnapshot(): SettingsSnapshot {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>(
    () => window.lightfastBridge.settings
  );
  useEffect(() => window.lightfastBridge.onSettingsChanged(setSnapshot), []);
  return snapshot;
}
