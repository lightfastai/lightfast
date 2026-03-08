"use client";

import { NotificationsTrigger } from "@vendor/knock/components/trigger";
import { useParams } from "next/navigation";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

/**
 * Application header - full width with workspace switcher on left and user actions on right
 */
export function AppHeader() {
  const params = useParams();

  const workspaceName =
    typeof params.workspaceName === "string" ? params.workspaceName : undefined;
  const orgSlug = typeof params.slug === "string" ? params.slug : undefined;

  return (
    <div className="flex w-full items-center pl-2">
      {/* Left side - Workspace switcher */}
      {workspaceName && orgSlug ? (
        <WorkspaceSwitcher orgSlug={orgSlug} workspaceName={workspaceName} />
      ) : (
        <div />
      )}

      {/* Right side - Notifications and User dropdown */}
      <div className="ml-auto flex items-center gap-3">
        <NotificationsTrigger />
        <UserDropdownMenu />
      </div>
    </div>
  );
}
