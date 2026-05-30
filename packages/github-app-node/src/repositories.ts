import { z } from "zod";
import { GitHubAppNodeError } from "./errors";
import {
  fetchGitHubJson,
  githubJsonHeaders,
  githubPathSegment,
  normalizeGitHubApiBaseUrl,
} from "./github-api";

const commitResponseSchema = z.object({
  sha: z.string().min(1),
  commit: z
    .object({
      tree: z.object({
        sha: z.string().min(1),
      }),
    })
    .optional(),
  tree: z
    .object({
      sha: z.string().min(1),
    })
    .optional(),
});

const treeResponseSchema = z.object({
  sha: z.string().min(1),
  tree: z.array(
    z.object({
      mode: z.string().min(1),
      path: z.string().min(1),
      sha: z.string().min(1),
      type: z.enum(["blob", "tree", "commit"]),
    })
  ),
  truncated: z.boolean().optional(),
});

const repositoryResponseSchema = z.object({
  full_name: z.string().min(1),
  id: z.union([z.number(), z.string().min(1)]),
  name: z.string().min(1),
  owner: z.object({
    login: z.string().min(1),
  }),
});

async function getJson(input: {
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  url: string | URL;
}) {
  const { json, response } = await fetchGitHubJson({
    fetch: input.fetch,
    init: {
      headers: githubJsonHeaders({
        apiVersion: input.apiVersion,
        token: input.installationToken,
      }),
    },
    requestErrorCode: "GITHUB_API_REQUEST_FAILED",
    requestErrorMessage: "GitHub repository request failed.",
    url: input.url,
  });
  if (!response.ok) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub repository response was not successful."
    );
  }
  return json;
}

export async function getGitHubCommit(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  owner: string;
  ref: string;
  repo: string;
}): Promise<{ sha: string; treeSha: string }> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/repos/${githubPathSegment(
    input.owner
  )}/${githubPathSegment(input.repo)}/git/commits/${githubPathSegment(
    input.ref
  )}`;
  const json = await getJson({
    apiVersion: input.apiVersion,
    fetch: input.fetch,
    installationToken: input.installationToken,
    url,
  });
  const parsed = commitResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub commit response was invalid."
    );
  }
  const treeSha = parsed.data.tree?.sha ?? parsed.data.commit?.tree.sha;
  if (!treeSha) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub commit response was invalid."
    );
  }
  return { sha: parsed.data.sha, treeSha };
}

export async function getGitHubRepository(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  owner: string;
  repo: string;
}): Promise<{
  fullName: string;
  id: string;
  name: string;
  owner: string;
}> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/repos/${githubPathSegment(
    input.owner
  )}/${githubPathSegment(input.repo)}`;
  const json = await getJson({
    apiVersion: input.apiVersion,
    fetch: input.fetch,
    installationToken: input.installationToken,
    url,
  });
  const parsed = repositoryResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub repository response was invalid."
    );
  }
  return {
    fullName: parsed.data.full_name,
    id: String(parsed.data.id),
    name: parsed.data.name,
    owner: parsed.data.owner.login,
  };
}

export async function getGitHubTree(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  owner: string;
  recursive?: boolean;
  repo: string;
  treeSha: string;
}): Promise<z.infer<typeof treeResponseSchema>> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = new URL(
    `${apiBaseUrl}/repos/${githubPathSegment(input.owner)}/${githubPathSegment(
      input.repo
    )}/git/trees/${githubPathSegment(input.treeSha)}`
  );
  if (input.recursive) {
    url.searchParams.set("recursive", "1");
  }
  const json = await getJson({
    apiVersion: input.apiVersion,
    fetch: input.fetch,
    installationToken: input.installationToken,
    url: url.toString(),
  });
  const parsed = treeResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub tree response was invalid."
    );
  }
  return parsed.data;
}
