import type {
  SourceEvent,
  SourceReference,
  TransformContext,
} from "@repo/console-types";
import type {
  PushEvent,
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
} from "@octokit/webhooks-types";

/**
 * Transform GitHub push event to SourceEvent
 */
export function transformGitHubPush(
  payload: PushEvent,
  context: TransformContext
): SourceEvent {
  const refs: SourceReference[] = [];
  const branch = payload.ref.replace("refs/heads/", "");

  // Add commit references
  refs.push({
    type: "commit",
    id: payload.after,
    url: `${payload.repository.html_url}/commit/${payload.after}`,
  });

  refs.push({
    type: "branch",
    id: branch,
    url: `${payload.repository.html_url}/tree/${branch}`,
  });

  // Add changed file count to title
  const fileCount = payload.commits.reduce(
    (sum, c) => sum + c.added.length + c.modified.length + c.removed.length,
    0
  );

  const title =
    payload.head_commit?.message?.split("\n")[0]?.slice(0, 100) ||
    `Push to ${branch}`;

  // SEMANTIC CONTENT ONLY (for embedding)
  // Structured fields stored in metadata
  const body = payload.head_commit?.message || "";

  return {
    source: "github",
    sourceType: "push",
    sourceId: `push:${payload.repository.full_name}:${payload.after}`,
    title: `[Push] ${title}`,
    body, // Semantic content only
    actor: payload.pusher?.name
      ? {
          id: `github:${payload.pusher.name}`,
          name: payload.pusher.name,
          email: payload.pusher.email || undefined,
        }
      : undefined,
    occurredAt: payload.head_commit?.timestamp || new Date().toISOString(),
    references: refs,
    metadata: {
      // All structured fields moved to metadata
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      branch,
      beforeSha: payload.before,
      afterSha: payload.after,
      commitCount: payload.commits.length,
      fileCount,
      forced: payload.forced,
    },
  };
}

/**
 * Transform GitHub pull request event to SourceEvent
 */
export function transformGitHubPullRequest(
  payload: PullRequestEvent,
  context: TransformContext
): SourceEvent {
  const pr = payload.pull_request;
  const refs: SourceReference[] = [];

  refs.push({
    type: "pr",
    id: `#${pr.number}`,
    url: pr.html_url,
  });

  refs.push({
    type: "branch",
    id: pr.head.ref,
    url: `${payload.repository.html_url}/tree/${pr.head.ref}`,
  });

  if (pr.head.sha) {
    refs.push({
      type: "commit",
      id: pr.head.sha,
      url: `${payload.repository.html_url}/commit/${pr.head.sha}`,
    });
  }

  // Extract linked issues from body
  const linkedIssues = extractLinkedIssues(pr.body || "");
  for (const issue of linkedIssues) {
    refs.push({
      type: "issue",
      id: issue.id,
      url: issue.url,
      label: issue.label, // "fixes", "closes", etc.
    });
  }

  // Add reviewers
  for (const reviewer of pr.requested_reviewers || []) {
    if ("login" in reviewer) {
      refs.push({
        type: "reviewer",
        id: reviewer.login,
        url: `https://github.com/${reviewer.login}`,
      });
    }
  }

  // Add assignees
  for (const assignee of pr.assignees || []) {
    refs.push({
      type: "assignee",
      id: assignee.login,
      url: `https://github.com/${assignee.login}`,
    });
  }

  // Add labels
  for (const label of pr.labels || []) {
    refs.push({
      type: "label",
      id: typeof label === "string" ? label : label.name || "",
    });
  }

  const actionMap: Record<string, string> = {
    opened: "PR Opened",
    closed: pr.merged ? "PR Merged" : "PR Closed",
    reopened: "PR Reopened",
    review_requested: "Review Requested",
    ready_for_review: "Ready for Review",
  };

  const actionTitle = actionMap[payload.action] || `PR ${payload.action}`;

  // SEMANTIC CONTENT ONLY (for embedding)
  // Structured fields stored in metadata to avoid token waste on non-semantic labels
  const body = [pr.title, pr.body || ""].join("\n");

  return {
    source: "github",
    sourceType: `pull_request_${payload.action}`,
    sourceId: `pr:${payload.repository.full_name}#${pr.number}:${payload.action}`,
    title: `[${actionTitle}] ${pr.title.slice(0, 100)}`,
    body, // Semantic content only
    actor: pr.user
      ? {
          id: `github:${pr.user.id}`,
          name: pr.user.login,
          avatarUrl: pr.user.avatar_url,
        }
      : undefined,
    occurredAt: pr.updated_at || pr.created_at,
    references: refs,
    metadata: {
      // All structured fields moved to metadata (not in body)
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      prNumber: pr.number,
      action: payload.action,
      merged: pr.merged,
      draft: pr.draft,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      headSha: pr.head.sha,
      authorLogin: pr.user?.login,
      authorId: pr.user?.id,
    },
  };
}

/**
 * Transform GitHub issues event to SourceEvent
 */
export function transformGitHubIssue(
  payload: IssuesEvent,
  context: TransformContext
): SourceEvent {
  const issue = payload.issue;
  const refs: SourceReference[] = [];

  refs.push({
    type: "issue",
    id: `#${issue.number}`,
    url: issue.html_url,
  });

  // Add assignees
  for (const assignee of issue.assignees || []) {
    refs.push({
      type: "assignee",
      id: assignee.login,
      url: `https://github.com/${assignee.login}`,
    });
  }

  // Add labels
  for (const label of issue.labels || []) {
    refs.push({
      type: "label",
      id: typeof label === "string" ? label : label.name || "",
    });
  }

  const actionMap: Record<string, string> = {
    opened: "Issue Opened",
    closed: "Issue Closed",
    reopened: "Issue Reopened",
    assigned: "Issue Assigned",
    labeled: "Issue Labeled",
  };

  const actionTitle = actionMap[payload.action] || `Issue ${payload.action}`;

  // SEMANTIC CONTENT ONLY (for embedding)
  const body = [issue.title, issue.body || ""].join("\n");

  return {
    source: "github",
    sourceType: `issue_${payload.action}`,
    sourceId: `issue:${payload.repository.full_name}#${issue.number}:${payload.action}`,
    title: `[${actionTitle}] ${issue.title.slice(0, 100)}`,
    body, // Semantic content only
    actor: issue.user
      ? {
          id: `github:${issue.user.id}`,
          name: issue.user.login,
          avatarUrl: issue.user.avatar_url,
        }
      : undefined,
    occurredAt: issue.updated_at || issue.created_at,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      issueNumber: issue.number,
      action: payload.action,
      state: issue.state,
      authorLogin: issue.user?.login,
      authorId: issue.user?.id,
    },
  };
}

/**
 * Transform GitHub release event to SourceEvent
 */
export function transformGitHubRelease(
  payload: ReleaseEvent,
  context: TransformContext
): SourceEvent {
  const release = payload.release;
  const refs: SourceReference[] = [];

  refs.push({
    type: "branch",
    id: release.target_commitish,
    url: `${payload.repository.html_url}/tree/${release.target_commitish}`,
  });

  const actionMap: Record<string, string> = {
    published: "Release Published",
    created: "Release Created",
    released: "Release Released",
  };

  const actionTitle = actionMap[payload.action] || `Release ${payload.action}`;

  // SEMANTIC CONTENT ONLY (for embedding)
  const body = release.body || "";

  return {
    source: "github",
    sourceType: `release_${payload.action}`,
    sourceId: `release:${payload.repository.full_name}:${release.tag_name}`,
    title: `[${actionTitle}] ${release.name || release.tag_name}`,
    body, // Semantic content only
    actor: release.author
      ? {
          id: `github:${release.author.id}`,
          name: release.author.login,
          avatarUrl: release.author.avatar_url,
        }
      : undefined,
    occurredAt: release.published_at || release.created_at || new Date().toISOString(),
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      tagName: release.tag_name,
      targetCommitish: release.target_commitish,
      action: payload.action,
      prerelease: release.prerelease,
      draft: release.draft,
      authorLogin: release.author?.login,
      authorId: release.author?.id,
    },
  };
}

/**
 * Transform GitHub discussion event to SourceEvent
 */
export function transformGitHubDiscussion(
  payload: DiscussionEvent,
  context: TransformContext
): SourceEvent {
  const discussion = payload.discussion;
  const refs: SourceReference[] = [];

  // Add category
  if (discussion.category) {
    refs.push({
      type: "label",
      id: discussion.category.name,
    });
  }

  const actionMap: Record<string, string> = {
    created: "Discussion Created",
    answered: "Discussion Answered",
    closed: "Discussion Closed",
  };

  const actionTitle =
    actionMap[payload.action] || `Discussion ${payload.action}`;

  // SEMANTIC CONTENT ONLY (for embedding)
  const body = [discussion.title, discussion.body || ""].join("\n");

  return {
    source: "github",
    sourceType: `discussion_${payload.action}`,
    sourceId: `discussion:${payload.repository.full_name}#${discussion.number}`,
    title: `[${actionTitle}] ${discussion.title.slice(0, 100)}`,
    body, // Semantic content only
    actor: discussion.user
      ? {
          id: `github:${discussion.user.id}`,
          name: discussion.user.login,
          avatarUrl: discussion.user.avatar_url,
        }
      : undefined,
    occurredAt: discussion.updated_at || discussion.created_at,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      discussionNumber: discussion.number,
      action: payload.action,
      category: discussion.category?.name,
      answered: discussion.answer_html_url !== null,
      authorLogin: discussion.user?.login,
      authorId: discussion.user?.id,
    },
  };
}

/**
 * Extract linked issues from PR/issue body
 * Matches: fixes #123, closes #123, resolves #123
 */
function extractLinkedIssues(
  body: string
): Array<{ id: string; url?: string; label: string }> {
  const pattern = /(fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
  const matches: Array<{ id: string; url?: string; label: string }> = [];
  let match;

  while ((match = pattern.exec(body)) !== null) {
    matches.push({
      id: `#${match[2]}`,
      label: match[1]?.toLowerCase().replace(/e?s$/, "") || "fixes",
    });
  }

  return matches;
}

// Export all transformers
export const githubTransformers = {
  push: transformGitHubPush,
  pull_request: transformGitHubPullRequest,
  issues: transformGitHubIssue,
  release: transformGitHubRelease,
  discussion: transformGitHubDiscussion,
};
