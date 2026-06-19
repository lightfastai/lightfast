import type { OrgSetupRequirement } from "@repo/api-contract";

export function pathForSetupRequirement(input: {
  orgSlug: string;
  requirement: OrgSetupRequirement;
}): string {
  switch (input.requirement) {
    case "github_org":
      return `/${input.orgSlug}/tasks/bind`;
    case "github_lightfast_repo":
      return `/${input.orgSlug}/tasks/github/lightfast-repo`;
    case "x_connector":
      return `/${input.orgSlug}/tasks/connectors/x`;
    default: {
      const exhaustive: never = input.requirement;
      return exhaustive;
    }
  }
}

export function githubSetupCompletePath(input: { orgSlug: string }): string {
  return `/${input.orgSlug}/tasks/bind/github/complete`;
}

export function xConnectorSetupCompletePath(input: {
  orgSlug: string;
}): string {
  return `/${input.orgSlug}/tasks/connectors/x/complete`;
}

export function accountTeamsPath(): string {
  return "/account/teams";
}

export function connectorCatalogPath(input: { orgSlug: string }): string {
  return `/${input.orgSlug}/connectors`;
}

export function signInPath(): string {
  return "/sign-in";
}

export const githubSetupRedirectPaths = {
  accountTeams: accountTeamsPath,
  bind: ({ orgSlug }: { orgSlug: string }) =>
    pathForSetupRequirement({ orgSlug, requirement: "github_org" }),
  complete: githubSetupCompletePath,
  signIn: signInPath,
};

export const xConnectorOAuthRedirectPaths = {
  accountTeams: accountTeamsPath,
  connectorPage: connectorCatalogPath,
  setupComplete: xConnectorSetupCompletePath,
  signIn: signInPath,
};
