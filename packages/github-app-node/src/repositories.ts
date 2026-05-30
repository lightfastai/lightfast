import { z } from "zod";
import { GitHubAppNodeError } from "./errors";

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

function normalizeApiBaseUrl(value: string | undefined) {
  return (value ?? "https://api.github.com").replace(/\/+$/, "");
}

function headers(input: { apiVersion?: string; installationToken: string }) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${input.installationToken}`,
    ...(input.apiVersion ? { "x-github-api-version": input.apiVersion } : {}),
  };
}

function pathSegment(value: string) {
  return encodeURIComponent(value);
}

async function getJson(input: {
  fetch: typeof fetch;
  headers: Record<string, string>;
  url: string;
}) {
  let res: Response;
  try {
    res = await input.fetch(input.url, { headers: input.headers });
  } catch {
    throw new GitHubAppNodeError(
      "GITHUB_API_REQUEST_FAILED",
      "GitHub repository request failed."
    );
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
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
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/repos/${pathSegment(input.owner)}/${pathSegment(
    input.repo
  )}/git/commits/${pathSegment(input.ref)}`;
  const json = await getJson({
    fetch: input.fetch ?? fetch,
    headers: headers(input),
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
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);
  const url = new URL(
    `${apiBaseUrl}/repos/${pathSegment(input.owner)}/${pathSegment(
      input.repo
    )}/git/trees/${pathSegment(input.treeSha)}`
  );
  if (input.recursive) {
    url.searchParams.set("recursive", "1");
  }
  const json = await getJson({
    fetch: input.fetch ?? fetch,
    headers: headers(input),
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
