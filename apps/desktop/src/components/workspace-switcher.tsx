import { useEffect, useState } from "react";
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
  currentWorkspaceId,
  className,
}: WorkspaceSwitcherProps) {
  const navigate = useNavigate();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  // Find current workspace index
  const currentIndex = workspaces.findIndex(
    (ws) => ws.id === currentWorkspaceId,
  );

  // Handle workspace navigation
  const navigateToWorkspace = (workspaceId: string) => {
    if (transitioning) return;

    setTransitioning(true);
    navigate({
      to: "/workspace/$workspaceId",
      params: { workspaceId },
    });

    // Reset transitioning state after animation completes
    setTimeout(() => setTransitioning(false), 300);
  };

  // Navigate to next workspace
  const goToNextWorkspace = () => {
    if (currentIndex < workspaces.length - 1) {
      navigateToWorkspace(workspaces[currentIndex + 1].id);
    }
  };

  // Navigate to previous workspace
  const goToPrevWorkspace = () => {
    if (currentIndex > 0) {
      navigateToWorkspace(workspaces[currentIndex - 1].id);
    }
  };

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
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

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [currentIndex, workspaces]);

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
          disabled={currentIndex <= 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Dots for workspaces */}
        <div className="flex items-center gap-1.5">
          {workspaces.map((workspace, index) => (
            <button
              key={workspace.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                workspace.id === currentWorkspaceId
                  ? "w-4 bg-orange-500"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5",
              )}
              onClick={() => navigateToWorkspace(workspace.id)}
              aria-label={`Switch to workspace: ${workspace.name}`}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full opacity-50 hover:opacity-100"
          onClick={goToNextWorkspace}
          disabled={currentIndex >= workspaces.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
