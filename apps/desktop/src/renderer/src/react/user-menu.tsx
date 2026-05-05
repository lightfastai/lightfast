import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTRPC } from "@repo/app-trpc/react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Settings, User } from "lucide-react";

export function UserMenu() {
  const trpc = useTRPC();
  const query = useQuery(trpc.account.get.queryOptions());

  const email = query.data?.primaryEmailAddress ?? "";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button aria-label="Settings" className="item" type="button">
          <Settings className="item__icon" size={16} />
          <span className="item__label">Settings</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          className="user-menu-content"
          side="top"
          sideOffset={6}
        >
          <DropdownMenu.Label className="user-menu-label">
            <User className="user-menu-icon" size={14} />
            <span className="user-menu-email">{email}</span>
          </DropdownMenu.Label>

          <DropdownMenu.Separator className="user-menu-separator" />

          <DropdownMenu.Item
            className="user-menu-item"
            onSelect={() => void window.lightfastBridge.openWindow("settings")}
          >
            <Settings className="user-menu-icon" size={14} />
            Settings
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="user-menu-separator" />

          <DropdownMenu.Item
            className="user-menu-item user-menu-item--destructive"
            onSelect={() => void window.lightfastBridge.auth.signOut()}
          >
            <LogOut className="user-menu-icon" size={14} />
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
