import {
  type GitHubNormalizedInstallation,
  githubNormalizedInstallationSchema,
} from "@repo/github-app-contract";
import { z } from "zod";

import { GitHubAppNodeError } from "./errors";
import {
  fetchGitHubJson,
  githubJsonHeaders,
  normalizeGitHubApiBaseUrl,
} from "./github-api";

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

const appInstallationResponseSchema = rawInstallationSchema.extend({
  html_url: z.string().url(),
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

export interface GitHubAppInstallation {
  account: {
    id: string;
    login: string;
    type: "Organization" | "User";
  };
  htmlUrl: string;
  id: string;
  targetType: "Organization" | "User";
}

function normalizePerPage(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return 100;
  }

  return Math.min(100, Math.max(1, Math.trunc(value)));
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

export async function getGitHubAppInstallation(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  appJwt: string;
  fetch?: typeof fetch;
  installationId: string;
}): Promise<GitHubAppInstallation> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/app/installations/${input.installationId}`;

  const { json, response } = await fetchGitHubJson({
    fetch: input.fetch,
    init: {
      headers: githubJsonHeaders({
        apiVersion: input.apiVersion,
        token: input.appJwt,
      }),
    },
    requestErrorCode: "INSTALLATION_NOT_VERIFIED",
    requestErrorMessage: "GitHub installation request failed.",
    url,
  });

  const parsed = appInstallationResponseSchema.safeParse(json);
  if (!(response.ok && parsed.success)) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub installation response was invalid."
    );
  }

  return {
    account: {
      id: String(parsed.data.account.id),
      login: parsed.data.account.login,
      type: parsed.data.account.type,
    },
    htmlUrl: parsed.data.html_url,
    id: String(parsed.data.id),
    targetType: parsed.data.target_type,
  };
}

function hasNextInstallationsPage(input: {
  currentCount: number;
  pageCount: number;
  perPage: number;
  totalCount?: number;
}) {
  if (input.totalCount === undefined) {
    return input.pageCount > 0 && input.pageCount >= input.perPage;
  }

  return (
    input.pageCount > 0 &&
    input.pageCount >= input.perPage &&
    input.currentCount < input.totalCount
  );
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

  const { json, response } = await fetchGitHubJson({
    fetch: input.fetch,
    init: {
      headers: githubJsonHeaders({
        apiVersion: input.apiVersion,
        token: input.userAccessToken,
      }),
    },
    requestErrorCode: "INSTALLATION_NOT_VERIFIED",
    requestErrorMessage: "GitHub installation verification request failed.",
    url,
  });
  const parsed = userInstallationsResponseSchema.safeParse(json);
  if (!(response.ok && parsed.success)) {
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
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const perPage = normalizePerPage(input.perPage);
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

    if (
      !hasNextInstallationsPage({
        currentCount: installations.length,
        pageCount: data.installations.length,
        perPage,
        totalCount: data.total_count,
      })
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
  const requestFetch = input.fetch ?? fetch;
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const perPage = normalizePerPage(input.perPage);
  let page = 1;
  let installationCount = 0;

  for (;;) {
    const data = await fetchInstallationsPage({
      apiBaseUrl,
      apiVersion: input.apiVersion,
      fetch: requestFetch,
      page,
      perPage,
      userAccessToken: input.userAccessToken,
    });

    const normalizedInstallations = data.installations.map(
      normalizeInstallation
    );
    const installation = normalizedInstallations.find(
      (candidate) => candidate.id === input.expectedInstallationId
    );

    if (installation) {
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

    installationCount += normalizedInstallations.length;

    if (
      !hasNextInstallationsPage({
        currentCount: installationCount,
        pageCount: data.installations.length,
        perPage,
        totalCount: data.total_count,
      })
    ) {
      break;
    }

    page += 1;
  }

  throw new GitHubAppNodeError(
    "INSTALLATION_NOT_VERIFIED",
    "GitHub user cannot access the expected installation."
  );
}
