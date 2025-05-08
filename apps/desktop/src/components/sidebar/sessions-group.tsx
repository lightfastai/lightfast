import { useState } from "react";
import { useActiveSessionId } from "@/hooks/use-active-session-id";
import { trpc } from "@/trpc";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Plus } from "lucide-react";

import { queryClient } from "@repo/trpc-client/trpc-react-proxy-provider";
import { Button } from "@repo/ui/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";

interface Session {
  id: string;
  title: string;
  updatedAt: Date;
}

interface SessionsGroupProps {
  sessions: Session[];
  workspaceId: string;
  onCreateWorkspace: () => void;
}

export function SessionsGroup({
  sessions,
  workspaceId,
  onCreateWorkspace,
}: SessionsGroupProps) {
  const navigate = useNavigate();
  const [activeSessionId, setActiveSessionId] = useActiveSessionId();

  // Touch/swipe navigation state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Current session index - should be determined by the actual session in view
  const currentSessionIndex = 0;

  // Create session mutation
  const createSession = useMutation(
    trpc.tenant.session.create.mutationOptions({
      onSuccess: (data) => {
        if (data && workspaceId) {
          // Invalidate sessions query to refresh the list
          queryClient.invalidateQueries(
            trpc.tenant.session.list.queryFilter({
              workspaceId,
            }),
          );

          // Navigate to the workspace with the new session
          navigate({
            to: "/workspace/$workspaceId",
            params: { workspaceId },
            // Force TanStack Router to clear any potential cached matches
            replace: true,
            // Make sure the router does fresh matching
            startTransition: true,
          });

          // Close the sidebar
          // toggleSidebar();
        }
      },
    }),
  );

  const handleNewSession = () => {
    if (workspaceId) {
      createSession.mutate({
        workspaceId,
      });
    } else {
      // If no workspace exists, create one first
      onCreateWorkspace();
    }
  };

  // Navigate to adjacent session
  const navigateToSession = (targetSessionId: string) => {
    if (isTransitioning || !targetSessionId) return;

    setIsTransitioning(true);

    // Apply navigation to session
    setTimeout(() => {
      // In a real implementation, you'd navigate to the specific session
      // For now, we'll just toggle the sidebar
      // toggleSidebar();

      // Reset transition after navigation
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    }, 50);
  };

  // Go to next session
  const goToNextSession = () => {
    if (currentSessionIndex < sessions.length - 1 && currentSessionIndex >= 0) {
      navigateToSession(sessions[currentSessionIndex + 1].id);
    }
  };

  // Go to previous session
  const goToPrevSession = () => {
    if (currentSessionIndex > 0) {
      navigateToSession(sessions[currentSessionIndex - 1].id);
    }
  };

  // Handle touch events for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    // Stop propagation to prevent triggering parent's touch handlers
    e.stopPropagation();
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Stop propagation to prevent triggering parent's touch handlers
    e.stopPropagation();
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Stop propagation to prevent triggering parent's touch handlers
    e.stopPropagation();

    if (!touchStart || !touchEnd) return;

    // Minimum swipe distance - 50px
    const minSwipeDistance = 50;
    const distance = touchStart - touchEnd;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        // Left swipe - go to next session
        goToNextSession();
      } else {
        // Right swipe - go to previous session
        goToPrevSession();
      }
    }

    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <SidebarGroup>
      <div className="flex items-center justify-between">
        <SidebarGroupLabel>
          <span>Chat Sessions</span>
        </SidebarGroupLabel>
      </div>

      <Button
        variant="ghost"
        className="mt-2 w-full justify-start gap-2 text-xs hover:border hover:border-orange-500 dark:hover:border-orange-500 dark:hover:bg-orange-500/10"
        onClick={handleNewSession}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500">
          <Plus className="h-4 w-4 text-white" />
        </div>
        <span>New Session</span>
      </Button>

      <SidebarMenu
        className="mt-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {sessions.map((session: Session) => (
          <SidebarMenuItem key={session.id}>
            <SidebarMenuButton
              asChild
              className={cn(
                session.id === activeSessionId &&
                  "relative bg-orange-500/10 font-medium",
              )}
            >
              <Link
                to="/workspace/$workspaceId"
                params={{ workspaceId }}
                onClick={() => {
                  // Update active session ID
                  setActiveSessionId(session.id);

                  // Close the sidebar
                  // toggleSidebar();
                }}
                className={cn(
                  "flex items-center gap-2",
                  session.id === activeSessionId && "text-orange-500",
                )}
                preload="intent"
              >
                {session.id === activeSessionId && (
                  <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-orange-500" />
                )}
                <MessageSquare className="h-4 w-4" />
                <span>{session.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {sessions.length === 0 && (
          <div className="text-muted-foreground px-3 py-2 text-xs">
            No chat sessions yet. Create a new one to get started.
          </div>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
