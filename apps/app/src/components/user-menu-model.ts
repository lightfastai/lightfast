export const SETTINGS_HREF = "/account/settings/general" as const;

interface UserMenuIdentityProfile {
  primaryEmailAddress: string | null;
  username: string | null;
}

export function getUserMenuIdentity(profile: UserMenuIdentityProfile) {
  const identityLines = [profile.username, profile.primaryEmailAddress].filter(
    (value): value is string => Boolean(value)
  );

  return {
    primaryIdentity: identityLines[0] ?? "User",
    secondaryIdentity: identityLines[1] ?? null,
  };
}
