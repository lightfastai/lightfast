"use client";

import dynamic from "next/dynamic";

const DebugPanel = dynamic(
  () => import("./debug-panel").then((m) => m.DebugPanel),
  { ssr: false },
);

export function DebugPanelLoader({
  slug,
  workspaceName,
}: {
  slug: string;
  workspaceName: string;
}) {
  return <DebugPanel slug={slug} workspaceName={workspaceName} />;
}
