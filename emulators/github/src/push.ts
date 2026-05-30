interface PushFile {
  content: string;
  path: string;
}

interface PushGitHubEmulatorCommitInput {
  apiBaseUrl: string;
  branch: string;
  files: PushFile[];
  message: string;
  owner: string;
  repo: string;
  token: string;
}

async function githubJson<T>(
  url: string,
  init: RequestInit,
  expectedStatus: number
): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as T;
  if (res.status !== expectedStatus) {
    throw new Error(
      `GitHub emulator request failed: ${res.status} ${url} ${JSON.stringify(
        json
      )}`
    );
  }
  return json;
}

function headers(token: string) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

function pathSegment(value: string) {
  return encodeURIComponent(value);
}

export async function pushGitHubEmulatorCommit(
  input: PushGitHubEmulatorCommitInput
): Promise<{ afterSha: string; beforeSha: string }> {
  const base = input.apiBaseUrl.replace(/\/+$/, "");
  const repoUrl = `${base}/repos/${pathSegment(input.owner)}/${pathSegment(
    input.repo
  )}`;
  const ref = await githubJson<{
    object: { sha: string };
  }>(
    `${repoUrl}/git/ref/heads/${pathSegment(input.branch)}`,
    { headers: headers(input.token) },
    200
  );
  const beforeSha = ref.object.sha;
  const commit = await githubJson<{
    commit?: { tree?: { sha?: string } };
    tree?: { sha?: string };
  }>(
    `${repoUrl}/git/commits/${pathSegment(beforeSha)}`,
    { headers: headers(input.token) },
    200
  );
  const baseTreeSha = commit.tree?.sha ?? commit.commit?.tree?.sha;
  if (!baseTreeSha) {
    throw new Error(`GitHub emulator commit ${beforeSha} did not include a tree sha`);
  }
  const tree = await githubJson<{ sha: string }>(
    `${repoUrl}/git/trees`,
    {
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: input.files.map((file) => ({
          content: file.content,
          mode: "100644",
          path: file.path,
          type: "blob",
        })),
      }),
      headers: headers(input.token),
      method: "POST",
    },
    201
  );
  const nextCommit = await githubJson<{ sha: string }>(
    `${repoUrl}/git/commits`,
    {
      body: JSON.stringify({
        message: input.message,
        parents: [beforeSha],
        tree: tree.sha,
      }),
      headers: headers(input.token),
      method: "POST",
    },
    201
  );
  await githubJson(
    `${repoUrl}/git/refs/heads/${pathSegment(input.branch)}`,
    {
      body: JSON.stringify({
        force: false,
        sha: nextCommit.sha,
      }),
      headers: headers(input.token),
      method: "PATCH",
    },
    200
  );

  return {
    afterSha: nextCommit.sha,
    beforeSha,
  };
}
