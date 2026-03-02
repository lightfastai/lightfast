"use client";

import { NotificationsTrigger } from "@vendor/knock/components/trigger";
import { UserDropdownMenu } from "~/components/user-dropdown-menu";
import { TeamSwitcher } from "~/components/team-switcher";

export function UserPageHeader() {
	return (
		<div className="sticky top-0 z-10 h-14 flex items-center px-4 bg-background border-b border-border md:border-b-0 md:bg-transparent">
			<TeamSwitcher mode="account" />
			<div className="flex items-center gap-3 ml-auto">
				<NotificationsTrigger />
				<UserDropdownMenu />
			</div>
		</div>
	);
}
