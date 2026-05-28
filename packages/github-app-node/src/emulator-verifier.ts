import {
  type GitHubNormalizedInstallation,
  githubNormalizedInstallationSchema,
} from "@repo/github-app-contract";
import { z } from "zod";

import { GitHubAppNodeError } from "./errors";

const githubEmulatorInstallationResponseSchema = z.object({
  account: z.object({
    id: z.union([z.number(), z.string().min(1)]),
    login: z.string().min(1),
    type: z.enum(["Organization", "User"]),
  }),
  app_id: z.union([z.number(), z.string().min(1)]),
  app_slug: z.string().min(1).nullable().optional(),
  events: z.array(z.string()).optional(),
  id: z.union([z.number(), z.string().min(1)]),
  permissions: z.record(z.string(), z.string()).optional(),
  repository_selection: z.enum(["all", "selected"]).optional(),
  suspended_at: z.string().nullable().optional(),
  target_type: z.enum(["Organization", "User"]),
});

async function getJson(input: {
  fetch: typeof fetch;
  token: string;
  url: string;
}) {
  let res: Response;
  try {
    res = await input.fetch(input.url, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.token}`,
      },
    });
  } catch {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub emulator verification request failed."
    );
  }

  if (!res.ok) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub emulator verification request failed."
    );
  }

  try {
    return await res.json();
  } catch {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub emulator verification response was invalid."
    );
  }
}

export async function verifyGitHubEmulatorInstallation(input: {
  emulatorOrigin: string;
  expectedInstallationId: string;
  expectedOrgLogin: string;
  fetch?: typeof fetch;
  userAccessToken: string;
}): Promise<GitHubNormalizedInstallation> {
  const requestFetch = input.fetch ?? fetch;
  const origin = input.emulatorOrigin.replace(/\/+$/, "");

  await getJson({
    fetch: requestFetch,
    token: input.userAccessToken,
    url: `${origin}/user`,
  });

  const orgs = await getJson({
    fetch: requestFetch,
    token: input.userAccessToken,
    url: `${origin}/user/orgs`,
  });

  const hasOrgAccess =
    Array.isArray(orgs) &&
    orgs.some(
      (org) =>
        org &&
        typeof org === "object" &&
        "login" in org &&
        org.login === input.expectedOrgLogin
    );

  if (!hasOrgAccess) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub user cannot access the expected emulator org."
    );
  }

  const rawInstallation = (await getJson({
    fetch: requestFetch,
    token: input.userAccessToken,
    url: `${origin}/orgs/${input.expectedOrgLogin}/installation`,
  })) as unknown;

  if (
    rawInstallation &&
    typeof rawInstallation === "object" &&
    (("target_type" in rawInstallation &&
      rawInstallation.target_type === "User") ||
      ("account" in rawInstallation &&
        rawInstallation.account &&
        typeof rawInstallation.account === "object" &&
        "type" in rawInstallation.account &&
        rawInstallation.account.type === "User"))
  ) {
    throw new GitHubAppNodeError(
      "PERSONAL_ACCOUNT_NOT_SUPPORTED",
      "Only GitHub organization installations are supported."
    );
  }

  const parsedInstallation =
    githubEmulatorInstallationResponseSchema.safeParse(rawInstallation);
  if (!parsedInstallation.success) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub emulator installation response was invalid."
    );
  }
  const installation = parsedInstallation.data;

  if (String(installation.id) !== input.expectedInstallationId) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub emulator installation id did not match callback id."
    );
  }

  if (
    installation.target_type !== "Organization" ||
    installation.account.type !== "Organization"
  ) {
    throw new GitHubAppNodeError(
      "PERSONAL_ACCOUNT_NOT_SUPPORTED",
      "Only GitHub organization installations are supported."
    );
  }

  const normalizedInstallation = githubNormalizedInstallationSchema.safeParse({
    account: {
      id: String(installation.account.id),
      login: installation.account.login,
      type: installation.account.type,
    },
    appId: String(installation.app_id),
    appSlug: installation.app_slug ?? null,
    events: installation.events ?? [],
    id: String(installation.id),
    permissions: installation.permissions ?? {},
    repositorySelection: installation.repository_selection ?? "all",
    suspendedAt: installation.suspended_at ?? null,
    targetType: installation.target_type,
  });
  if (!normalizedInstallation.success) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub emulator installation response was invalid."
    );
  }

  return normalizedInstallation.data;
}
