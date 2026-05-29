import {
  type GitHubNormalizedInstallation,
  githubNormalizedInstallationSchema,
} from "@repo/github-app-contract";
import { z } from "zod";

import { GitHubAppNodeError } from "./errors";

const rawInstallationSchema = z.object({
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

const userInstallationsResponseSchema = z.object({
  installations: z.array(rawInstallationSchema),
  total_count: z.number().int().min(0).optional(),
});

export interface ListGitHubUserAccessibleInstallationsInput {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  perPage?: number;
  userAccessToken: string;
}

export interface VerifyGitHubUserInstallationInput
  extends ListGitHubUserAccessibleInstallationsInput {
  expectedInstallationId: string;
}

function normalizeApiBaseUrl(value: string | undefined) {
  return (value ?? "https://api.github.com").replace(/\/+$/, "");
}

function normalizeInstallation(
  installation: z.infer<typeof rawInstallationSchema>
): GitHubNormalizedInstallation {
  const parsed = githubNormalizedInstallationSchema.safeParse({
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

  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub installation response was invalid."
    );
  }

  return parsed.data;
}

async function fetchInstallationsPage(input: {
  apiBaseUrl: string;
  apiVersion?: string;
  fetch: typeof fetch;
  page: number;
  perPage: number;
  userAccessToken: string;
}) {
  const url = new URL("/user/installations", input.apiBaseUrl);
  url.searchParams.set("per_page", String(input.perPage));
  url.searchParams.set("page", String(input.page));

  let res: Response;
  try {
    res = await input.fetch(url.toString(), {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.userAccessToken}`,
        ...(input.apiVersion
          ? { "x-github-api-version": input.apiVersion }
          : {}),
      },
    });
  } catch {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub installation verification request failed."
    );
  }

  const json = await res.json().catch(() => null);
  const parsed = userInstallationsResponseSchema.safeParse(json);
  if (!res.ok || !parsed.success) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub installation verification response was invalid."
    );
  }

  return parsed.data;
}

export async function listGitHubUserAccessibleInstallations(
  input: ListGitHubUserAccessibleInstallationsInput
): Promise<GitHubNormalizedInstallation[]> {
  const requestFetch = input.fetch ?? fetch;
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);
  const perPage = input.perPage ?? 100;
  const installations: GitHubNormalizedInstallation[] = [];
  let page = 1;

  for (;;) {
    const data = await fetchInstallationsPage({
      apiBaseUrl,
      apiVersion: input.apiVersion,
      fetch: requestFetch,
      page,
      perPage,
      userAccessToken: input.userAccessToken,
    });

    installations.push(...data.installations.map(normalizeInstallation));

    const totalCount = data.total_count ?? installations.length;
    if (
      data.installations.length === 0 ||
      data.installations.length < perPage ||
      installations.length >= totalCount
    ) {
      break;
    }

    page += 1;
  }

  return installations;
}

export async function verifyGitHubUserInstallation(
  input: VerifyGitHubUserInstallationInput
): Promise<GitHubNormalizedInstallation> {
  const installations = await listGitHubUserAccessibleInstallations(input);
  const installation = installations.find(
    (candidate) => candidate.id === input.expectedInstallationId
  );

  if (!installation) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub user cannot access the expected installation."
    );
  }

  if (
    installation.targetType !== "Organization" ||
    installation.account.type !== "Organization"
  ) {
    throw new GitHubAppNodeError(
      "PERSONAL_ACCOUNT_NOT_SUPPORTED",
      "Only GitHub organization installations are supported."
    );
  }

  return installation;
}
