/**
 * URL Builder for Neural Memory content
 *
 * Constructs source URLs from document/observation metadata.
 */

// Regex patterns for GitHub sourceId parsing
const PR_PATTERN = /pr:([^#]+)#(\d+)/;
const ISSUE_PATTERN = /issue:([^#]+)#(\d+)/;
const PUSH_PATTERN = /push:([^:]+):([a-f0-9]+)/;
const RELEASE_PATTERN = /release:([^:]+):([^:]+)/;
const DISCUSSION_PATTERN = /discussion:([^#]+)#(\d+)/;

/**
 * Build source URL based on source type and ID patterns.
 */
export function buildSourceUrl(
  source: string,
  sourceId: string,
  metadata?: Record<string, unknown>
): string {
  switch (source) {
    case "github":
      return buildGitHubUrl(sourceId, metadata);
    case "vercel":
      return buildVercelUrl(sourceId, metadata);
    case "linear":
      return buildLinearUrl(sourceId, metadata);
    default:
      // Fallback to metadata URL if available
      if (metadata?.url && typeof metadata.url === "string") {
        return metadata.url;
      }
      return "";
  }
}

/**
 * Build GitHub URL from sourceId patterns.
 *
 * Patterns:
 * - PR: "pr:owner/repo#123:merged" -> https://github.com/owner/repo/pull/123
 * - Issue: "issue:owner/repo#45:opened" -> https://github.com/owner/repo/issues/45
 * - Push: "push:owner/repo:abc123" -> https://github.com/owner/repo/commit/abc123
 * - File: "owner/repo/path/to/file.md" -> https://github.com/owner/repo/blob/main/path/to/file.md
 */
function buildGitHubUrl(
  sourceId: string,
  metadata?: Record<string, unknown>
): string {
  // PR pattern: pr:owner/repo#123:action
  if (sourceId.startsWith("pr:")) {
    const match = PR_PATTERN.exec(sourceId);
    if (match?.[1] && match[2]) {
      return `https://github.com/${match[1]}/pull/${match[2]}`;
    }
  }

  // Issue pattern: issue:owner/repo#45:action
  if (sourceId.startsWith("issue:")) {
    const match = ISSUE_PATTERN.exec(sourceId);
    if (match?.[1] && match[2]) {
      return `https://github.com/${match[1]}/issues/${match[2]}`;
    }
  }

  // Push/commit pattern: push:owner/repo:sha
  if (sourceId.startsWith("push:")) {
    const match = PUSH_PATTERN.exec(sourceId);
    if (match?.[1] && match[2]) {
      return `https://github.com/${match[1]}/commit/${match[2]}`;
    }
  }

  // Release pattern: release:owner/repo:tag:action
  if (sourceId.startsWith("release:")) {
    const match = RELEASE_PATTERN.exec(sourceId);
    if (match?.[1] && match[2]) {
      return `https://github.com/${match[1]}/releases/tag/${match[2]}`;
    }
  }

  // Discussion pattern: discussion:owner/repo#10
  if (sourceId.startsWith("discussion:")) {
    const match = DISCUSSION_PATTERN.exec(sourceId);
    if (match?.[1] && match[2]) {
      return `https://github.com/${match[1]}/discussions/${match[2]}`;
    }
  }

  // File path pattern: owner/repo/path/to/file.md
  // Use commit SHA from metadata if available
  const commitSha =
    metadata?.commitSha && typeof metadata.commitSha === "string"
      ? metadata.commitSha
      : "main";
  const path = sourceId.replace(/^\//, "");

  // Extract owner/repo from path
  const parts = path.split("/");
  if (parts.length >= 3 && parts[0] && parts[1]) {
    const owner = parts[0];
    const repo = parts[1];
    const filePath = parts.slice(2).join("/");
    return `https://github.com/${owner}/${repo}/blob/${commitSha}/${filePath}`;
  }

  // Fallback to metadata URL
  if (metadata?.url && typeof metadata.url === "string") {
    return metadata.url;
  }
  return "";
}

/**
 * Build Vercel URL from sourceId.
 *
 * Pattern: "deployment:project:id" -> https://vercel.com/project/deployments/id
 */
function buildVercelUrl(
  sourceId: string,
  metadata?: Record<string, unknown>
): string {
  // Use metadata URL if available (Vercel provides full URLs)
  if (metadata?.url && typeof metadata.url === "string") {
    return metadata.url;
  }

  // Deployment pattern
  if (sourceId.startsWith("deployment:")) {
    const parts = sourceId.split(":");
    if (parts.length >= 3 && parts[1] && parts[2]) {
      return `https://vercel.com/${parts[1]}/deployments/${parts[2]}`;
    }
  }

  return "";
}

/**
 * Build Linear URL from sourceId.
 *
 * Pattern: "issue:TEAM-123" -> https://linear.app/team/issue/TEAM-123
 */
function buildLinearUrl(
  sourceId: string,
  metadata?: Record<string, unknown>
): string {
  // Use metadata URL if available
  if (metadata?.url && typeof metadata.url === "string") {
    return metadata.url;
  }

  // Issue pattern: issue:TEAM-123
  if (sourceId.startsWith("issue:")) {
    const issueId = sourceId.replace("issue:", "");
    const teamKeyPart = issueId.split("-")[0];
    const teamKey = teamKeyPart ? teamKeyPart.toLowerCase() : "team";
    return `https://linear.app/${teamKey}/issue/${issueId}`;
  }

  return "";
}
