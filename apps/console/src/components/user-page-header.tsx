"use client";

import { useTRPC } from "@repo/console-trpc/react";
import { TeamSwitcher } from "@repo/ui/components/app-header/team-switcher";
import { UserMenu } from "@repo/ui/components/app-header/user-menu";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useClerk, useOrganizationList, useUser } from "@vendor/clerk/client";
import { NotificationsTrigger } from "@vendor/knock/components/trigger";
import { authUrl } from "~/lib/related-projects";

export function UserPageHeader() {
  const trpc = useTRPC();
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const { setActive } = useOrganizationList();

  const { data: organizations = [] } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const handleOrgSelect = async (orgId: string) => {
    if (setActive) {
      await setActive({ organization: orgId });
    }
  };

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
    <div className="sticky top-0 z-10 flex h-14 items-center border-border border-b bg-background px-4 md:border-b-0 md:bg-transparent">
      <TeamSwitcher
        createTeamHref="/account/teams/new"
        mode="account"
        onOrgSelect={handleOrgSelect}
        organizations={organizations}
      />
      <div className="ml-auto flex items-center gap-3">
        <NotificationsTrigger />
        {isLoaded && user && (
          <UserMenu
            email={email}
            initials={initials}
            onSignOut={() =>
              void signOut({ redirectUrl: `${authUrl}/sign-in` })
            }
            settingsHref="/account/settings/general"
          />
        )}
      </div>
    </div>
  );
}
