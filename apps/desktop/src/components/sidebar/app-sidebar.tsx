import { useCurrentWorkspaceId } from "@/hooks/use-current-workspace-id";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";

import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";

// Import the workspace switcher from the component directory
import { WorkspaceSwitcher } from "../workspace-switcher";
import { ConnectionIndicators } from "./connection-indicators";
import { SessionsGroup } from "./sessions-group";
import { useCreateWorkspaceMutation } from "./use-create-workspace";
import { UserDropdown } from "./user-dropdown";

export function AppSidebar() {
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

  return (
    <Sidebar variant="inset" className="p-0">
      <SidebarHeader className="border-b pt-16">
        <ConnectionIndicators />
      </SidebarHeader>
      <SidebarContent className="flex flex-1 flex-col divide-y overflow-hidden">
        <ScrollArea className="flex-1">
          {/* Sessions Group with touch/swipe navigation */}
          <SessionsGroup
            sessions={sessions}
            workspaceId={currentWorkspaceId}
            onCreateWorkspace={createWorkspace}
          />
        </ScrollArea>

        {/* Workspace Switcher at bottom */}
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
