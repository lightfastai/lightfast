// Import the correct types from the ai package
import type { Message } from "ai";
import { SessionManager, WorkspaceChat } from "@/components/chat";
import { RootLayout } from "@/components/root-layout";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

export default function WorkspacePage() {
  const { workspaceId } = useParams({
    from: "/workspace/$workspaceId",
  });

  const { data: workspace } = useQuery(
    trpc.tenant.workspace.get.queryOptions({ workspaceId }),
  );

  return (
    <RootLayout>
      <div className="bg-background flex h-screen flex-col">
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <SessionManager workspaceId={workspaceId}>
              {({ activeSessionId, activeSession }) => (
                <WorkspaceChat
                  workspaceId={workspaceId}
                  sessionId={activeSessionId}
                  initialMessages={(activeSession?.messages as Message[]) || []}
                />
              )}
            </SessionManager>
          </div>
        </div>
      </div>
    </RootLayout>
  );
}

// Define window interface for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getClientEnv: () => Promise<any>;
      ping: () => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, listener: (...args: any[]) => void) => () => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
    blenderConnection: {
      onStatusUpdate: (callback: (status: any) => void) => () => void;
      sendToBlender: (message: object) => Promise<any>;
      getStatus: () => Promise<{ status: string; error?: string }>;
    };
  }
}
