"use client";

import { UserMenu } from "@repo/ui/components/app-header/user-menu";
import { useClerk, useUser } from "@vendor/clerk/client";
import { NotificationsTrigger } from "@vendor/knock/components/trigger";
/**
 * Application header - full width with workspace switcher on left and user actions on right
 */
export function AppHeader() {
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    user?.username ??
    "";

  const initials = (() => {
    if (!user) {
      return "LF";
    }
    const { firstName, lastName, username } = user;
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    if (lastName) {
      return lastName.substring(0, 2).toUpperCase();
    }
    if (username) {
      return username.substring(0, 2).toUpperCase();
    }
    return "LF";
  })();

  return (
    <div className="flex w-full items-center pl-2">
      {/* Left side placeholder */}
      <div />

      {/* Right side - Notifications and User dropdown */}
      <div className="ml-auto flex items-center gap-3">
        <NotificationsTrigger />
        {isLoaded && user && (
          <UserMenu
            email={email}
            initials={initials}
            onSignOut={() => void signOut({ redirectUrl: "/sign-in" })}
            settingsHref="/account/settings/general"
          />
        )}
      </div>
    </div>
  );
}
