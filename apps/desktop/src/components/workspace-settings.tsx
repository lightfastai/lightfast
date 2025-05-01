import { trpc } from "@/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Settings } from "lucide-react";

import { queryClient } from "@repo/trpc-client/trpc-react-proxy-provider";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";

interface WorkspaceSettingsProps {
  workspaceId: string;
}

export function WorkspaceSettings({ workspaceId }: WorkspaceSettingsProps) {
  // Get the current workspace
  const { data: workspace } = useQuery(
    trpc.tenant.workspace.get.queryOptions({ workspaceId }),
  );

  // Update workspace name mutation
  const { mutate: updateName } = useMutation(
    trpc.tenant.workspace.updateName.mutationOptions({
      async onSuccess() {
        // Invalidate queries to refetch data
        await Promise.all([
          queryClient.invalidateQueries(
            trpc.tenant.workspace.get.queryFilter({ workspaceId }),
          ),
          queryClient.invalidateQueries(
            trpc.tenant.workspace.getAll.queryFilter(),
          ),
        ]);
      },
    }),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Workspace Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="p-2">
          <Label htmlFor="name" className="text-xs font-medium">
            Name
          </Label>
          <Input
            id="name"
            value={workspace?.name}
            onChange={(e) =>
              updateName({
                id: workspaceId,
                workspaceName: e.target.value,
              })
            }
            className="mt-1.5"
          />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive">
          Delete Workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
