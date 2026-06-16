import type { OrgSetupRequirement } from "@repo/app-setup-contract";

export function isOrgSetupPath(slug: string, pathname: string) {
  if (pathname === `/${slug}/tasks`) {
    return true;
  }

  return pathname.startsWith(`/${slug}/tasks/`);
}

export function isOrgSetupCompletePath(slug: string, pathname: string) {
  return (
    pathname === `/${slug}/tasks/bind/github/complete` ||
    pathname === `/${slug}/tasks/connectors/x/complete`
  );
}

export function isOrgSettingsPath(slug: string, pathname: string) {
  const settingsRoot = `/${slug}/settings`;
  return pathname === settingsRoot || pathname.startsWith(`${settingsRoot}/`);
}

export function isOrgSetupExemptPath(slug: string, pathname: string) {
  return isOrgSetupPath(slug, pathname) || isOrgSettingsPath(slug, pathname);
}

export function getSetupRequirementRedirect(
  requirement: OrgSetupRequirement | string,
  slug: string
) {
  switch (requirement) {
    case "github_lightfast_repo":
      return {
        params: { slug },
        to: "/$slug/tasks/github/lightfast-repo",
      };
    case "x_connector":
      return {
        params: { slug },
        to: "/$slug/tasks/connectors/x",
      };
    default:
      return {
        params: { slug },
        to: "/$slug/tasks/bind",
      };
  }
}
