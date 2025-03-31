"use client";

import { Icons } from "@repo/ui/components/icons";

import { WorkspaceIconButton } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useCreateWorkspace } from "../../hooks/use-create-workspace";

export function EditorFileMenu() {
  const { mutateAsync } = useCreateWorkspace();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <WorkspaceIconButton variant="outline">
          <Icons.logo className="size-3" />
        </WorkspaceIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => mutateAsync()}>
          <span>New Workspace</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <span>Settings</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
