"use client";

import { Icons } from "@repo/ui/components/icons";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ForwardedDropdownMenuTriggerButton,
} from "~/components/ui/dropdown-menu";
import { useCreateWorkspace } from "../../hooks/use-create-workspace";

export function EditorFileMenu() {
  const { mutateAsync } = useCreateWorkspace();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ForwardedDropdownMenuTriggerButton variant="outline">
          <Icons.logo className="size-3" />
        </ForwardedDropdownMenuTriggerButton>
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
