"use client";

import { TeamSwitcher } from "@repo/ui/components/app-header/team-switcher";
import { UserMenu } from "@repo/ui/components/app-header/user-menu";
import { useClerk, useOrganizationList, useUser } from "@vendor/clerk/client";

export function UserPageHeader() {
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const { setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const organizations = (userMemberships.data ?? []).map((m) => ({
    id: m.organization.id,
    slug: m.organization.slug,
    name: m.organization.name,
  }));

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
