import { ChevronDownIcon } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

import { NetworkEditorContext } from "~/app/(app)/(stable)/(workspace)/workspace/state/context";
import { EditorCommandDialog } from "./editor-command-dialog";
import { EditorHeaderButton } from "./editor-header-button";

export const EditorHeaderHelpers = () => {
  const machineRef = NetworkEditorContext.useActorRef();
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <EditorHeaderButton
            variant="ghost"
            className="h-8 px-2 transition-transform hover:scale-105 hover:bg-muted/50"
          >
            <Avatar className="size-5">
              <AvatarImage src="/avatar-placeholder.webp" />
              <AvatarFallback>v</AvatarFallback>
            </Avatar>
            <ChevronDownIcon className="size-4" />
          </EditorHeaderButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditorHeaderButton
        onClick={() => machineRef.send({ type: "TOGGLE_COMMAND" })}
      >
        Press
        <kbd className="pointer-events-none inline-flex select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </EditorHeaderButton>
      <EditorHeaderButton
        onClick={() => {
          machineRef.send({ type: "CLEAR" });
        }}
      >
        Clear Canvas
      </EditorHeaderButton>
      <EditorCommandDialog />
    </div>
  );
};
