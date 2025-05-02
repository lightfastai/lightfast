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
import { WorkspacesGroup } from "./workspaces-group";

export function AppSidebar() {
  const { data: workspaces = [] } = useQuery(
    trpc.tenant.workspace.getAll.queryOptions(),
  );
  const { mutate: createWorkspace } = useCreateWorkspaceMutation();

  // Get the current workspace ID using router's useParams if possible
  // But have a fallback when not in a route with workspaceId
  const currentWorkspaceIdFromPath =
    window.location.pathname.match(/\/workspace\/([^/]+)/)?.[1] || "";
  const currentWorkspaceId = currentWorkspaceIdFromPath;

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

          {/* Workspaces Group - only show when in a workspace */}
          {currentWorkspaceId && (
            <WorkspacesGroup
              workspaces={workspaces}
              currentWorkspaceId={currentWorkspaceId}
              onCreateWorkspace={createWorkspace}
            />
          )}
        </ScrollArea>

        {/* Workspace Switcher at bottom */}
        {workspaces.length > 0 && (
          <div className="mt-auto border-t pt-4">
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
