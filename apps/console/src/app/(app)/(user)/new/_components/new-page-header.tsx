"use client";

import { NotificationsTrigger } from "@vendor/knock/components/trigger";
import { UserDropdownMenu } from "~/components/user-dropdown-menu";
import { TeamSwitcher } from "~/components/team-switcher";

export function NewPageHeader() {
  return (
    <div className="h-14 flex items-center px-4">
      <TeamSwitcher mode="account" />
      <div className="flex items-center gap-3 ml-auto">
        <NotificationsTrigger />
        <UserDropdownMenu />
      </div>
    </div>
  );
}
