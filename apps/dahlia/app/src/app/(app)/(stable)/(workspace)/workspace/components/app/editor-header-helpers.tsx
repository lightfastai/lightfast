import { useRouter } from "next/navigation";
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
import { useSession } from "~/hooks/use-session";
import { useSignOut } from "~/hooks/use-sign-out";
import { EditorCommandDialog } from "./editor-command-dialog";
import { EditorHeaderButton } from "./editor-header-button";

export const EditorHeaderHelpers = () => {
  const machineRef = NetworkEditorContext.useActorRef();
  const session = useSession();
  const { signOut } = useSignOut();
  const router = useRouter();
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background">
      {session?.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <EditorHeaderButton
              variant="ghost"
              className="h-8 px-2 transition-transform hover:scale-105 hover:bg-muted/50"
            >
              <Avatar className="size-5 rounded-lg">
                <AvatarImage
                  src={session?.user?.image ?? "/avatar-placeholder.webp"}
                  className="rounded-lg"
                />
                <AvatarFallback className="rounded-lg">v</AvatarFallback>
              </Avatar>
              <ChevronDownIcon className="size-4" />
            </EditorHeaderButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => signOut()}>
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <EditorHeaderButton onClick={() => router.push("/login")}>
          Sign In
        </EditorHeaderButton>
      )}
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
