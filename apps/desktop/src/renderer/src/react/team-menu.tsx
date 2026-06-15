import { Avatar, AvatarFallback } from "@repo/ui-v2/components/ui/avatar";
import { Button } from "@repo/ui-v2/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { SettingsIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAuthSnapshot } from "./use-auth-snapshot";

export function TeamMenu() {
  const auth = useAuthSnapshot();
  const organizationName = auth.organizationName ?? "Team";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open team menu"
            className="cursor-default p-0 [-webkit-app-region:no-drag]"
            size="icon"
            type="button"
            variant="square"
          />
        }
      >
        <Avatar className="size-7 rounded-md">
          <AvatarFallback className="rounded-md bg-foreground text-[10px] text-background">
            {organizationName.trim().charAt(0).toUpperCase() || "T"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="z-[100] w-56"
        side="right"
        sideOffset={8}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex select-none items-center gap-2">
            <Avatar className="size-6 rounded-md">
              <AvatarFallback className="rounded-md bg-foreground text-[10px] text-background">
                {organizationName.trim().charAt(0).toUpperCase() || "T"}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate">{organizationName}</span>
          </DropdownMenuLabel>
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
            <HugeiconsIcon aria-hidden="true" icon={SettingsIcon} size={14} />
            Team Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
