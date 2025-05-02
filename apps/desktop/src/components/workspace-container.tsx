import { useEffect, useRef, useState } from "react";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";
import { useMatch, useNavigate } from "@tanstack/react-router";

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
  const workspaceMatch = useMatch({ from: "/workspace/$workspaceId" });
  const workspaceId = workspaceMatch?.params?.workspaceId;
  const containerRef = useRef<HTMLDivElement>(null);

  // Track touch/swipe state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Track transition state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<
    "left" | "right" | null
  >(null);

  // Get all workspaces
  const { data: workspaces = [] } = useQuery(
    trpc.tenant.workspace.getAll.queryOptions(),
  );

  // Find current workspace index
  const currentIndex = workspaceId
    ? workspaces.findIndex((ws) => ws.id === workspaceId)
    : -1;

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

  // Go to next workspace
  const goToNextWorkspace = () => {
    if (currentIndex < workspaces.length - 1 && currentIndex >= 0) {
      navigateToWorkspace(workspaces[currentIndex + 1].id, "left");
    }
  };

  // Go to previous workspace
  const goToPrevWorkspace = () => {
    if (currentIndex > 0) {
      navigateToWorkspace(workspaces[currentIndex - 1].id, "right");
    }
  };

  // Handle touch events for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!workspaceId) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!workspaceId) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || !workspaceId) return;

    // Minimum swipe distance - 50px
    const minSwipeDistance = 50;
    const distance = touchStart - touchEnd;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        // Left swipe - go to next workspace
        goToNextWorkspace();
      } else {
        // Right swipe - go to previous workspace
        goToPrevWorkspace();
      }
    }

    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we're in a workspace context
      if (!workspaceId) return;

      // Alt+Left/Right for workspace navigation
      if (e.altKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goToPrevWorkspace();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          goToNextWorkspace();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, workspaceId, workspaces]);

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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="h-full w-full">{children}</div>
    </div>
  );
}
