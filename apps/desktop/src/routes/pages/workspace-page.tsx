// Import the correct types from the ai package
import { useEffect } from "react";
import { SessionManager } from "@/components/chat/session-manager";
import { RootLayout } from "@/components/root-layout";
import { SessionOrchestrator } from "@/components/session/session-orchestrator";
import { trpc } from "@/trpc";
import { prefetchWorkspaceData } from "@/utils/prefetch-utils";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

export default function WorkspacePage() {
  const { workspaceId } = useParams({
    from: "/workspace/$workspaceId",
  });

  // Get workspace data with eager prefetching
  const { data: workspace, isLoading: isWorkspaceLoading } = useQuery(
    trpc.tenant.workspace.get.queryOptions({ workspaceId }),
  );

  // Prefetch sessions for this workspace for improved loading experience
  useEffect(() => {
    if (workspaceId) {
      // Prefetch all related workspace data
      prefetchWorkspaceData(workspaceId);
    }
  }, [workspaceId]);

  return (
    <RootLayout>
      <div className="bg-background flex h-full flex-col">
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <SessionManager workspaceId={workspaceId}>
              {({ activeSessionId, activeSession }) => (
                <SessionOrchestrator
                  workspaceId={workspaceId}
                  sessionId={activeSessionId}
                  initialMessages={activeSession?.messages || []}
                />
              )}
            </SessionManager>
          </div>
        </div>
      </div>
    </RootLayout>
  );
}
