"use client";

import { useParams } from "next/navigation";
import { NotificationsTrigger } from "@vendor/knock/components/trigger";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UserDropdownMenu } from "./user-dropdown-menu";

/**
 * Application header - full width with workspace switcher on left and user actions on right
 */
export function AppHeader() {
  const params = useParams();

  const workspaceName =
    typeof params.workspaceName === "string" ? params.workspaceName : undefined;
  const orgSlug = typeof params.slug === "string" ? params.slug : undefined;

  return (
    <div className="w-full flex items-center pl-2">
      {/* Left side - Workspace switcher */}
      {workspaceName && orgSlug ? (
        <WorkspaceSwitcher orgSlug={orgSlug} workspaceName={workspaceName} />
      ) : (
        <div />
      )}

      {/* Right side - Notifications and User dropdown */}
      <div className="flex items-center gap-3 ml-auto">
        <NotificationsTrigger />
        <UserDropdownMenu />
      </div>
    </div>
  );
}
