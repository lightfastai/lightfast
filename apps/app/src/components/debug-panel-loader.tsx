"use client";

import dynamic from "next/dynamic";

const DebugPanel = dynamic(
  () => import("./debug-panel").then((m) => m.DebugPanel),
  { ssr: false }
);

export function DebugPanelLoader() {
  return <DebugPanel />;
}
