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
        <button type="button" className="item" aria-label="Settings">
          <Settings size={16} className="item__icon" />
          <span className="item__label">Settings</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="user-menu-content"
          side="top"
          align="start"
          sideOffset={6}
        >
          <DropdownMenu.Label className="user-menu-label">
            <User size={14} className="user-menu-icon" />
            <span className="user-menu-email">{email}</span>
          </DropdownMenu.Label>

          <DropdownMenu.Separator className="user-menu-separator" />

          <DropdownMenu.Item
            className="user-menu-item"
            onSelect={() => {
              window.location.hash = "#/settings";
            }}
          >
            <Settings size={14} className="user-menu-icon" />
            Settings
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="user-menu-separator" />

          <DropdownMenu.Item
            className="user-menu-item user-menu-item--destructive"
            onSelect={() => void window.lightfastBridge.auth.signOut()}
          >
            <LogOut size={14} className="user-menu-icon" />
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
