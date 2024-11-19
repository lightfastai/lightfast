import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

import { useCreateWorkspace } from "~/app/(app)/(stable)/(workspace)/workspace/hooks/use-create-workspace";
import { Icons } from "~/app/icons";

export function EditorHeaderFile() {
  const { createWorkspace } = useCreateWorkspace();

  return (
    <div className="fixed inset-x-0 top-0 z-[1] p-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Icons.logo className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => createWorkspace()}>
            <span>New Workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
