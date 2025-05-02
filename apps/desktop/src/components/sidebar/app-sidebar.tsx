import { useEffect, useRef, useState } from "react";
import { useCurrentWorkspaceId } from "@/hooks/use-current-workspace-id";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";

// Import the workspace switcher from the component directory
import { WorkspaceSwitcher } from "../workspace-switcher";
import { ConnectionIndicators } from "./connection-indicators";
import { SessionsGroup } from "./sessions-group";
import { useCreateWorkspaceMutation } from "./use-create-workspace";
import { UserDropdown } from "./user-dropdown";

export function AppSidebar() {
  const navigate = useNavigate();
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const { data: workspaces = [] } = useQuery(
    trpc.tenant.workspace.getAll.queryOptions(),
  );
  const { mutate: createWorkspace } = useCreateWorkspaceMutation();

  // Get the current workspace ID using our custom hook
  // This handles all the router context edge cases for us
  const currentWorkspaceId = useCurrentWorkspaceId();

  // Get sessions for the current workspace
  const { data: sessions = [] } = useQuery(
    trpc.tenant.session.list.queryOptions({
      workspaceId: currentWorkspaceId ?? "",
    }),
  );

  // Simplified workspace data for the workspace switcher
  const workspacesData = workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
  }));

  // Touch tracking state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null,
  );
  const [swipeProgress, setSwipeProgress] = useState(0); // 0-100 for animation

  // Find current workspace index
  const currentIndex = workspacesData.findIndex(
    (workspace) => workspace.id === currentWorkspaceId,
  );

  // Navigate to adjacent workspace
  const navigateToWorkspace = (workspaceId: string) => {
    if (isTransitioning || !workspaceId) return;

    setIsTransitioning(true);

    navigate({
      to: "/workspace/$workspaceId",
      params: { workspaceId },
      // Force TanStack Router to clear any potential cached matches
      replace: true,
      // Make sure the router does fresh matching
      startTransition: true,
    });

    // Reset transition states after navigation
    setTimeout(() => {
      setIsTransitioning(false);
      setSwipeDirection(null);
      setSwipeProgress(0);
    }, 300);
  };

  // Go to next workspace
  const goToNextWorkspace = () => {
    if (
      currentIndex < workspacesData.length - 1 &&
      currentIndex >= 0 &&
      !isTransitioning
    ) {
      setSwipeDirection("left");
      navigateToWorkspace(workspacesData[currentIndex + 1].id);
    }
  };

  // Go to previous workspace
  const goToPrevWorkspace = () => {
    if (currentIndex > 0 && !isTransitioning) {
      setSwipeDirection("right");
      navigateToWorkspace(workspacesData[currentIndex - 1].id);
    }
  };

  // Touch event handlers for swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only handle if we have more than one workspace
    if (workspacesData.length <= 1) return;

    setTouchStart(e.touches[0].clientX);
    setTouchEnd(null);
    setSwipeProgress(0);
    setSwipeDirection(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || workspacesData.length <= 1) return;

    const currentX = e.touches[0].clientX;
    setTouchEnd(currentX);

    // Calculate swipe progress (0-100%)
    const maxSwipe = 200; // Max pixels for a full swipe
    const diff = touchStart - currentX;
    const direction = diff > 0 ? "left" : "right";

    // Only allow appropriate direction based on position
    if (
      (direction === "left" && currentIndex >= workspacesData.length - 1) ||
      (direction === "right" && currentIndex <= 0)
    ) {
      setSwipeProgress(0);
      setSwipeDirection(null);
      return;
    }

    const progress = Math.min((Math.abs(diff) / maxSwipe) * 100, 100);
    setSwipeProgress(progress);
    setSwipeDirection(direction);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || workspacesData.length <= 1) return;

    // Minimum swipe distance - 50px or 30% progress
    const minSwipeDistance = 50;
    const distance = touchStart - touchEnd;

    if (Math.abs(distance) >= minSwipeDistance || swipeProgress > 30) {
      if (distance > 0 && swipeDirection === "left") {
        // Left swipe - go to next workspace
        goToNextWorkspace();
      } else if (distance < 0 && swipeDirection === "right") {
        // Right swipe - go to previous workspace
        goToPrevWorkspace();
      }
    } else {
      // Reset visual feedback if swipe wasn't enough
      setSwipeDirection(null);
      setSwipeProgress(0);
    }

    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Support mouse wheel for workspace navigation (on Mac trackpad two-finger swipe)
  useEffect(() => {
    const element = sidebarContentRef.current;
    if (!element || workspacesData.length <= 1) return;

    // Keep track of wheel event timing to detect gesture end
    let lastWheelTime = 0;
    let wheelTimer: NodeJS.Timeout | null = null;

    const handleWheel = (e: WheelEvent) => {
      // Check if this is a horizontal scroll event (common for trackpad gestures)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 10) {
        // Prevent default to avoid page scrolling
        e.preventDefault();

        // Update the last wheel time
        lastWheelTime = Date.now();

        // Clear any existing timer
        if (wheelTimer) {
          clearTimeout(wheelTimer);
        }

        // Set direction based on wheel delta
        const direction = e.deltaX > 0 ? "left" : "right";

        // Only allow appropriate direction based on position
        if (
          (direction === "left" && currentIndex >= workspacesData.length - 1) ||
          (direction === "right" && currentIndex <= 0)
        ) {
          return;
        }

        setSwipeDirection(direction);

        // Create a new timer to detect when the gesture ends
        wheelTimer = setTimeout(() => {
          if (Date.now() - lastWheelTime >= 100) {
            // It's been 100ms since the last wheel event, assume gesture is complete
            if (swipeDirection === "left") {
              goToNextWorkspace();
            } else if (swipeDirection === "right") {
              goToPrevWorkspace();
            }

            wheelTimer = null;
          }
        }, 150);
      }
    };

    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel);
      if (wheelTimer) {
        clearTimeout(wheelTimer);
      }
    };
  }, [currentIndex, workspacesData, isTransitioning, swipeDirection]);

  return (
    <Sidebar variant="inset" className="p-0">
      <SidebarHeader className="border-b pt-16">
        <ConnectionIndicators />
      </SidebarHeader>
      <SidebarContent
        className={cn(
          "relative flex flex-1 flex-col divide-y overflow-hidden transition-transform duration-200",
          swipeDirection === "left" &&
            `transform translate-x-[-${swipeProgress}px]`,
          swipeDirection === "right" &&
            `transform translate-x-[${swipeProgress}px]`,
        )}
        ref={sidebarContentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <ScrollArea className="flex-1">
          {/* Sessions Group with touch/swipe navigation */}
          <SessionsGroup
            sessions={sessions}
            workspaceId={currentWorkspaceId}
            onCreateWorkspace={createWorkspace}
          />
        </ScrollArea>

        {/* Workspace Switcher dropdown at bottom */}
        {workspaces.length > 0 && (
          <div className="mt-auto pt-4">
            <WorkspaceSwitcher
              workspaces={workspacesData}
              currentWorkspaceId={currentWorkspaceId}
            />
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserDropdown />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
