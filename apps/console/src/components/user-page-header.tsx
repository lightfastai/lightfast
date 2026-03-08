"use client";

import { NotificationsTrigger } from "@vendor/knock/components/trigger";
import { TeamSwitcher } from "~/components/team-switcher";
import { UserDropdownMenu } from "~/components/user-dropdown-menu";

export function UserPageHeader() {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center border-border border-b bg-background px-4 md:border-b-0 md:bg-transparent">
      <TeamSwitcher mode="account" />
      <div className="ml-auto flex items-center gap-3">
        <NotificationsTrigger />
        <UserDropdownMenu />
      </div>
    </div>
  );
}
