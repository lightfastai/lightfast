import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

import { useSession } from "~/hooks/use-session";
import { useSignOut } from "~/hooks/use-sign-out";

export const EditorHeaderHelpers = () => {
  const session = useSession();
  const { signOut } = useSignOut();
  const router = useRouter();
  return (
    <div className="fixed top-0 right-0 z-[1] p-4">
      <div className="bg-background flex items-center gap-1 rounded-lg border">
        {session?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost">
                <Avatar className="size-5 rounded-lg">
                  <AvatarImage
                    src={session.user.image ?? "/avatar-placeholder.webp"}
                    className="rounded-lg"
                  />
                  <AvatarFallback className="rounded-lg">v</AvatarFallback>
                </Avatar>
                <ChevronDownIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => signOut()}>
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" onClick={() => router.push("/login")}>
            Sign In
          </Button>
        )}
        <Button
          variant="ghost"
          // onClick={() => machineRef.send({ type: "TOGGLE_COMMAND" })}
        >
          Press
          <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex items-center gap-1 rounded border px-1.5 font-mono text-xs font-medium opacity-100 select-none">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            // machineRef.send({ type: "CLEAR" });
          }}
        >
          Clear Canvas
        </Button>
      </div>
    </div>
  );
};
