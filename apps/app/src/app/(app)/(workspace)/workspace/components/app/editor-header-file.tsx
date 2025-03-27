"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

import { useCreateWorkspace } from "../../hooks/use-create-workspace";

export function EditorHeaderMenu() {
  const { mutateAsync } = useCreateWorkspace();
  return (
    <div className="fixed inset-x-0 top-0 z-10 p-4">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="outline">
            <Icons.logo />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => mutateAsync()}>
            <span>New Workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
