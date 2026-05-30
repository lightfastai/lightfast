import { z } from "zod";

import { GitHubAppNodeError } from "./errors";

const repositoryInstallationSchema = z.object({
  id: z.union([z.number(), z.string().min(1)]),
  repository_selection: z.enum(["all", "selected"]).optional(),
});

function normalizeApiBaseUrl(value: string | undefined) {
  return (value ?? "https://api.github.com").replace(/\/+$/, "");
}

function pathSegment(value: string) {
  return encodeURIComponent(value);
}

export async function verifyGitHubInstallationRepository(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  appJwt: string;
  expectedInstallationId: string;
  fetch?: typeof fetch;
  owner: string;
  repo: string;
}): Promise<{
  installationId: string;
  repositorySelection: "all" | "selected";
}> {
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/repos/${pathSegment(input.owner)}/${pathSegment(
    input.repo
  )}/installation`;

  let res: Response;
  try {
    res = await (input.fetch ?? fetch)(url, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.appJwt}`,
        ...(input.apiVersion
          ? { "x-github-api-version": input.apiVersion }
          : {}),
      },
    });
  } catch {
    throw new GitHubAppNodeError(
      "GITHUB_API_REQUEST_FAILED",
      "GitHub repository installation request failed."
    );
  }

  const json = await res.json().catch(() => null);
  if (res.status === 404) {
    throw new GitHubAppNodeError(
      "GITHUB_REPOSITORY_NOT_FOUND",
      "GitHub repository installation was not found."
    );
  }
  if (!res.ok) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub repository installation response was not successful."
    );
  }

  const parsed = repositoryInstallationSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub repository installation response was invalid."
    );
  }

  const installationId = String(parsed.data.id);
  if (installationId !== input.expectedInstallationId) {
    throw new GitHubAppNodeError(
      "GITHUB_REPOSITORY_INACCESSIBLE",
      "GitHub repository is attached to a different installation."
    );
  }

  return {
    installationId,
    repositorySelection: parsed.data.repository_selection ?? "all",
  };
}
