import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";

interface Workspace {
  id: string;
  name: string;
}

interface WorkspacesGroupProps {
  workspaces: Workspace[];
  currentWorkspaceId: string;
  onCreateWorkspace: () => void;
}

export function WorkspacesGroup({
  workspaces,
  currentWorkspaceId,
  onCreateWorkspace,
}: WorkspacesGroupProps) {
  return (
    <SidebarGroup className="p-4">
      <div className="mt-2 flex items-center justify-between">
        <SidebarGroupLabel>
          <span>Workspaces</span>
        </SidebarGroupLabel>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onCreateWorkspace}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SidebarMenu>
        {workspaces.map((workspace) => (
          <SidebarMenuItem key={workspace.id}>
            <SidebarMenuButton asChild>
              <Link
                to="/workspace/$workspaceId"
                params={{ workspaceId: workspace.id }}
                className={cn(
                  "flex items-center gap-2",
                  workspace.id === currentWorkspaceId &&
                    "font-medium text-orange-500",
                )}
                preload="intent"
              >
                <span>{workspace.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
