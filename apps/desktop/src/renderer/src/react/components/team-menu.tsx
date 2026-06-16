import { SettingsIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, AvatarFallback } from "@repo/ui-v2/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@repo/ui-v2/components/ui/sidebar";
import { useAuthSnapshot } from "../use-auth-snapshot";

export function TeamMenu() {
  const auth = useAuthSnapshot();
  const organizationName = auth.organizationName ?? "Team";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            aria-label="Open team menu"
            className="cursor-default [-webkit-app-region:no-drag]"
            shape="square"
            size="lg"
            type="button"
          />
        }
      >
        <Avatar>
          <AvatarFallback>
            {organizationName.trim().charAt(0).toUpperCase() || "T"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="z-100 w-56"
        side="right"
        sideOffset={8}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{organizationName}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() =>
              void window.lightfastBridge.openAppPath(
                auth.organizationSlug
                  ? `/${auth.organizationSlug}/settings`
                  : "/account/settings/general"
              )
            }
          >
            <HugeiconsIcon aria-hidden="true" icon={SettingsIcon} />
            Team Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
