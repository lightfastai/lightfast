import { useRef, useState } from "react";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { cn } from "@repo/ui/lib/utils";

interface WorkspaceContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function WorkspaceContainer({
  children,
  className,
}: WorkspaceContainerProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Track transition state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<
    "left" | "right" | null
  >(null);

  // Get all workspaces
  const { data: workspaces = [] } = useQuery(
    trpc.tenant.workspace.getAll.queryOptions(),
  );

  // Navigate to adjacent workspace
  const navigateToWorkspace = (
    targetWorkspaceId: string,
    direction: "left" | "right",
  ) => {
    if (isTransitioning || !targetWorkspaceId) return;

    setIsTransitioning(true);
    setTransitionDirection(direction);

    // Apply the transition classes with Tailwind
    setTimeout(() => {
      navigate({
        to: "/workspace/$workspaceId",
        params: { workspaceId: targetWorkspaceId },
      });

      // Reset transition after navigation
      setTimeout(() => {
        setIsTransitioning(false);
        setTransitionDirection(null);
      }, 300);
    }, 50);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden transition-transform duration-300 ease-in-out",
        className,
        isTransitioning &&
          transitionDirection === "left" &&
          "-translate-x-full",
        isTransitioning &&
          transitionDirection === "right" &&
          "translate-x-full",
      )}
    >
      <div className="h-full w-full">{children}</div>
    </div>
  );
}
