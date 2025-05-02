import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCurrentWorkspaceId,
  useCurrentWorkspaceId,
} from "@/hooks/use-current-workspace-id";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

interface WorkspaceSwitcherProps {
  workspaces: Array<{
    id: string;
    name: string;
  }>;
  currentWorkspaceId?: string;
  className?: string;
}

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspaceId: propCurrentWorkspaceId,
  className,
}: WorkspaceSwitcherProps) {
  const navigate = useNavigate();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  // Get the workspaceId from our custom hook as a backup/fallback
  // This handles router context edge cases and falls back to URL extraction if needed
  const urlWorkspaceId = useCurrentWorkspaceId();

  // Use prop value first, then fall back to URL value
  const currentWorkspaceId = propCurrentWorkspaceId || urlWorkspaceId;

  // Keep a reference to the current workspace ID for keyboard navigation
  const currentWorkspaceIdRef = useRef(currentWorkspaceId);

  // Update the ref when currentWorkspaceId changes
  useEffect(() => {
    currentWorkspaceIdRef.current = currentWorkspaceId;
  }, [currentWorkspaceId]);

  // Find current workspace index based on the most up-to-date ID
  const currentIndex = workspaces.findIndex(
    (ws) => ws.id === currentWorkspaceId,
  );

  // Also store index in ref for keyboard navigation
  const currentIndexRef = useRef(currentIndex);

  // Update the ref when currentIndex changes
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Handle workspace navigation with transition tracking
  const navigateToWorkspace = useCallback(
    (workspaceId: string) => {
      if (transitioning) return;

      setTransitioning(true);
      navigate({
        to: "/workspace/$workspaceId",
        params: { workspaceId },
      }).finally(() => {
        // Reset transitioning state after navigation completes
        setTransitioning(false);
      });
    },
    [navigate], // Remove transitioning from dependencies to avoid re-creating this function when transitioning changes
  );

  // Navigate to next workspace
  const goToNextWorkspace = useCallback(() => {
    console.log("goToNextWorkspace", currentIndex);
    // Use the ref value to get the most current index
    const idx = currentIndexRef.current;
    if (idx < workspaces.length - 1) {
      navigateToWorkspace(workspaces[idx + 1].id);
    }
  }, [workspaces, navigateToWorkspace]);

  // Navigate to previous workspace
  const goToPrevWorkspace = useCallback(() => {
    // Use the ref value to get the most current index
    const idx = currentIndexRef.current;
    if (idx > 0) {
      navigateToWorkspace(workspaces[idx - 1].id);
    }
  }, [workspaces, navigateToWorkspace]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent default touch behavior
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent default touch behavior
    if (touchStartX === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX;

    // Threshold for swipe detection (50px)
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swipe right, go to previous workspace
        goToPrevWorkspace();
      } else {
        // Swipe left, go to next workspace
        goToNextWorkspace();
      }
    }

    setTouchStartX(null);
  };

  // Manual URL sync function to update workspaceId on navigation
  const syncCurrentWorkspaceId = useCallback(() => {
    // Use the non-hook version to get current workspace ID synchronously
    const newUrlWorkspaceId = getCurrentWorkspaceId();

    if (
      newUrlWorkspaceId &&
      newUrlWorkspaceId !== currentWorkspaceIdRef.current
    ) {
      currentWorkspaceIdRef.current = newUrlWorkspaceId;
      // Update the index ref too
      const newIndex = workspaces.findIndex(
        (ws) => ws.id === newUrlWorkspaceId,
      );
      if (newIndex !== -1) {
        currentIndexRef.current = newIndex;
      }
    }
  }, [workspaces]);

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Sync current workspace ID before handling keyboard navigation
      syncCurrentWorkspaceId();

      // Using Alt+Left/Right for workspace navigation
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
  }, [goToPrevWorkspace, goToNextWorkspace, syncCurrentWorkspaceId]);

  return (
    <div
      className={cn("flex flex-col items-center gap-2 pb-4", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Workspace name display */}
      <div className="text-muted-foreground text-xs">
        {currentIndex !== -1
          ? workspaces[currentIndex]?.name
          : "No workspace selected"}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full opacity-50 hover:opacity-100"
          onClick={goToPrevWorkspace}
          disabled={currentIndex <= 0 || transitioning}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Dots for workspaces */}
        <div className="flex items-center gap-1.5">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                workspace.id === currentWorkspaceId
                  ? "w-4 bg-orange-500"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5",
              )}
              onClick={() => navigateToWorkspace(workspace.id)}
              disabled={transitioning}
              aria-label={`Switch to workspace: ${workspace.name}`}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full opacity-50 hover:opacity-100"
          onClick={goToNextWorkspace}
          disabled={currentIndex >= workspaces.length - 1 || transitioning}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
