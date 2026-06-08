import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Settings, User } from "lucide-react";
import { useTRPC } from "./trpc/react";
import { useAuthSnapshot } from "./use-auth-snapshot";

const itemClass =
  "flex w-full cursor-default items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-[12px] text-[#0d0d0d]/70 transition-colors [-webkit-app-region:no-drag] hover:bg-[#0d0d0d]/6 hover:text-[#0d0d0d] [.electron-dark_&]:text-white/70 [.electron-dark_&]:hover:bg-white/7 [.electron-dark_&]:hover:text-white";
const menuItemClass =
  "flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[#0d0d0d] outline-none data-[highlighted]:bg-[#0d0d0d]/6 [.electron-dark_&]:text-white [.electron-dark_&]:data-[highlighted]:bg-white/7";
const menuIconClass =
  "flex-shrink-0 text-[#0d0d0d]/50 [.electron-dark_&]:text-white/50";

export function UserMenu() {
  const auth = useAuthSnapshot();
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.viewer.account.get.queryOptions(),
    enabled: auth.isSignedIn,
  });

  const email = query.data?.primaryEmailAddress ?? auth.userEmail ?? "";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button aria-label="Open user menu" className={itemClass} type="button">
          <Settings className="size-4 flex-shrink-0" size={16} />
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            Settings
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          className="z-[100] min-w-[200px] rounded-lg border border-[#0d0d0d]/10 bg-white p-1 shadow-[0_4px_16px_rgb(0_0_0_/_30%),0_1px_4px_rgb(0_0_0_/_15%)] [.electron-dark_&]:border-white/10 [.electron-dark_&]:bg-[#282828]"
          side="top"
          sideOffset={6}
        >
          {auth.isSignedIn && (
            <>
              <DropdownMenu.Label className="flex select-none items-center gap-2 px-2 py-1.5 text-[#0d0d0d]/70 text-[12px] [.electron-dark_&]:text-white/70">
                <User className={menuIconClass} size={14} />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {email}
                </span>
              </DropdownMenu.Label>

              <DropdownMenu.Separator className="my-1 h-px bg-[#0d0d0d]/5 [.electron-dark_&]:bg-white/5" />
            </>
          )}

          <DropdownMenu.Item
            className={menuItemClass}
            onSelect={() => void window.lightfastBridge.openWindow("settings")}
          >
            <Settings className={menuIconClass} size={14} />
            Settings
          </DropdownMenu.Item>

          {auth.isSignedIn && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-[#0d0d0d]/5 [.electron-dark_&]:bg-white/5" />

              <DropdownMenu.Item
                className={cn(menuItemClass, "text-red-500")}
                onSelect={() => void window.lightfastBridge.auth.signOut()}
              >
                <LogOut className="flex-shrink-0 text-red-500" size={14} />
                Log out
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
