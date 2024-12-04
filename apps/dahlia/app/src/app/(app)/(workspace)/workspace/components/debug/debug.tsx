import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "@sentry/nextjs";
import { Panel } from "@xyflow/react";

import { InfoCard } from "@repo/ui/components/info-card";
import { Button } from "@repo/ui/components/ui/button";

import { useEdgeStore } from "../../providers/edge-store-provider";
import { useNodeStore } from "../../providers/node-store-provider";
import { WebGLStatsCard } from "../webgl/gl-stats-card";
import { WebGLPerformance } from "../webgl/performance-card";
import { SystemCard } from "../webgl/system-card";

interface DebugSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

// Separate the workspace info into its own memoized component
const WorkspaceInfo = memo(() => {
  const nodeCount = useNodeStore((state) => state.nodes.length);
  const edgeCount = useEdgeStore((state) => state.edges.length);

  return (
    <InfoCard
      title="Workspace Info"
      items={[
        { label: "nodes", value: nodeCount },
        { label: "edges", value: edgeCount },
      ]}
    />
  );
});
WorkspaceInfo.displayName = "WorkspaceInfo";

// Separate the button component
const DebugButton = memo<{
  id: string;
  title: string;
  isActive: boolean;
  onClick: (id: string) => void;
}>(({ id, title, isActive, onClick }) => (
  <Button
    variant={isActive ? "secondary" : "ghost"}
    size="sm"
    className="rounded-none text-xs"
    onClick={() => onClick(id)}
  >
    {title}
  </Button>
));
DebugButton.displayName = "DebugButton";

export const Debug = memo(() => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  // Memoize the sections array to prevent recreating on every render
  const sections: DebugSection[] = useMemo(
    () => [
      {
        id: "workspace",
        title: "Workspace",
        content: <WorkspaceInfo />,
      },
      {
        id: "performance",
        title: "Performance",
        content: (
          <ErrorBoundary>
            <WebGLPerformance />
          </ErrorBoundary>
        ),
      },
      {
        id: "system",
        title: "System",
        content: (
          <ErrorBoundary>
            <SystemCard />
          </ErrorBoundary>
        ),
      },
      {
        id: "webgl",
        title: "WebGL",
        content: (
          <ErrorBoundary>
            <WebGLStatsCard />
          </ErrorBoundary>
        ),
      },
    ],
    [],
  );

  // Memoize the click handler
  const handleSectionClick = useCallback((id: string) => {
    setActiveSection((current) => (current === id ? null : id));
  }, []);

  // Use ResizeObserver instead of window event listener for better performance
  useEffect(() => {
    if (!buttonContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        document.documentElement.style.setProperty(
          "--debug-panel-width",
          `${width}px`,
        );
      }
    });

    observer.observe(buttonContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Memoize the active content
  const activeContent = useMemo(
    () => sections.find((s) => s.id === activeSection)?.content,
    [sections, activeSection],
  );

  return (
    <Panel position="bottom-right">
      <div className="flex flex-col-reverse gap-2">
        <div
          ref={buttonContainerRef}
          className="flex items-center overflow-hidden rounded-md border bg-background/80 backdrop-blur"
        >
          {sections.map((section) => (
            <DebugButton
              key={section.id}
              id={section.id}
              title={section.title}
              isActive={activeSection === section.id}
              onClick={handleSectionClick}
            />
          ))}
        </div>
        {activeSection && (
          <div className="w-[var(--debug-panel-width)] animate-in fade-in slide-in-from-bottom-2">
            {activeContent}
          </div>
        )}
      </div>
    </Panel>
  );
});

Debug.displayName = "Debug";
