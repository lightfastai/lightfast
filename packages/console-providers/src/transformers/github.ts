import type { PostTransformEvent, PostTransformReference } from "../post-transform-event.js";
import type { TransformContext } from "../types.js";
import { validatePostTransformEvent, logValidationErrors } from "../validation.js";
import { sanitizeTitle, sanitizeBody } from "../sanitize.js";
import type {
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
} from "../schemas/github.js";

export function transformGitHubPush(
  payload: PreTransformGitHubPushEvent,
  context: TransformContext,
): PostTransformEvent {
  const refs: PostTransformReference[] = [];
  const branch = payload.ref.replace("refs/heads/", "");

  refs.push({
    type: "commit",
    id: payload.after,
    url: `${payload.repository.html_url}/commit/${payload.after}`,
    label: null,
  });

  refs.push({
    type: "branch",
    id: branch,
    url: `${payload.repository.html_url}/tree/${branch}`,
    label: null,
  });

  const fileCount = payload.commits.reduce(
    (sum, c) => sum + c.added.length + c.modified.length + c.removed.length,
    0,
  );

  const rawTitle =
    payload.head_commit?.message.split("\n")[0]?.slice(0, 100) ??
    `Push to ${branch}`;

  const rawBody = payload.head_commit?.message ?? "";

  const event: PostTransformEvent = {
    source: "github",
    sourceType: "push",
    sourceId: `push:${payload.repository.full_name}:${payload.after}`,
    title: sanitizeTitle(`[Push] ${rawTitle}`),
    body: sanitizeBody(rawBody),
    actor: {
      id: String(payload.sender.id),
      name: payload.sender.login,
      email: payload.pusher.email ?? null,
      avatarUrl: payload.sender.avatar_url,
    },
    occurredAt: payload.head_commit?.timestamp ?? new Date().toISOString(),
    references: refs,
    metadata: {
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

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformGitHubPush", event, validation.errors);
  }

  return event;
}

export function transformGitHubPullRequest(
  payload: PreTransformGitHubPullRequestEvent,
  context: TransformContext,
): PostTransformEvent {
  const pr = payload.pull_request;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "pr", id: `#${pr.number}`, url: pr.html_url, label: null });
  refs.push({
    type: "branch",
    id: pr.head.ref,
    url: `${payload.repository.html_url}/tree/${pr.head.ref}`,
    label: null,
  });

  if (pr.head.sha) {
    refs.push({
      type: "commit",
      id: pr.head.sha,
      url: `${payload.repository.html_url}/commit/${pr.head.sha}`,
      label: null,
    });
  }

  if (pr.merge_commit_sha) {
    refs.push({
      type: "commit",
      id: pr.merge_commit_sha,
      url: `${payload.repository.html_url}/commit/${pr.merge_commit_sha}`,
      label: "merge",
    });
  }

  const linkedIssues = extractLinkedIssues(pr.body ?? "");
  for (const issue of linkedIssues) {
    refs.push({ type: "issue", id: issue.id, url: issue.url, label: issue.label });
  }

  for (const reviewer of pr.requested_reviewers ?? []) {
    if ("login" in reviewer) {
      refs.push({ type: "reviewer", id: reviewer.login, url: `https://github.com/${reviewer.login}`, label: null });
    }
  }

  for (const assignee of pr.assignees ?? []) {
    refs.push({ type: "assignee", id: assignee.login, url: `https://github.com/${assignee.login}`, label: null });
  }

  for (const label of pr.labels ?? []) {
    refs.push({ type: "label", id: typeof label === "string" ? label : label.name, url: null, label: null });
  }

  const actionMap: Record<string, string> = {
    opened: "PR Opened",
    closed: pr.merged ? "PR Merged" : "PR Closed",
    reopened: "PR Reopened",
    review_requested: "Review Requested",
    ready_for_review: "Ready for Review",
  };

  const actionTitle = actionMap[payload.action] ?? `PR ${payload.action}`;
  const rawBody = [pr.title, pr.body ?? ""].join("\n");
  const effectiveAction = payload.action === "closed" && pr.merged ? "merged" : payload.action;

  const event: PostTransformEvent = {
    source: "github",
    sourceType: `pull-request.${effectiveAction}`,
    sourceId: `pr:${payload.repository.full_name}#${pr.number}:${effectiveAction}`,
    title: sanitizeTitle(`[${actionTitle}] ${pr.title.slice(0, 100)}`),
    body: sanitizeBody(rawBody),
    actor: pr.user
      ? { id: String(pr.user.id), name: pr.user.login, email: null, avatarUrl: pr.user.avatar_url }
      : null,
    occurredAt: pr.updated_at,
    references: refs,
    metadata: {
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

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformGitHubPullRequest", event, validation.errors);
  }

  return event;
}

export function transformGitHubIssue(
  payload: PreTransformGitHubIssuesEvent,
  context: TransformContext,
): PostTransformEvent {
  const issue = payload.issue;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "issue", id: `#${issue.number}`, url: issue.html_url, label: null });

  for (const assignee of issue.assignees ?? []) {
    refs.push({ type: "assignee", id: assignee.login, url: `https://github.com/${assignee.login}`, label: null });
  }

  for (const label of issue.labels ?? []) {
    refs.push({ type: "label", id: typeof label === "string" ? label : label.name, url: null, label: null });
  }

  const actionMap: Record<string, string> = {
    opened: "Issue Opened",
    closed: "Issue Closed",
    reopened: "Issue Reopened",
    assigned: "Issue Assigned",
    labeled: "Issue Labeled",
  };

  const actionTitle = actionMap[payload.action] ?? `Issue ${payload.action}`;
  const rawBody = [issue.title, issue.body ?? ""].join("\n");

  const event: PostTransformEvent = {
    source: "github",
    sourceType: `issue.${payload.action}`,
    sourceId: `issue:${payload.repository.full_name}#${issue.number}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitle}] ${issue.title.slice(0, 100)}`),
    body: sanitizeBody(rawBody),
    actor: issue.user
      ? { id: String(issue.user.id), name: issue.user.login, email: null, avatarUrl: issue.user.avatar_url }
      : null,
    occurredAt: issue.updated_at,
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

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformGitHubIssue", event, validation.errors);
  }

  return event;
}

export function transformGitHubRelease(
  payload: PreTransformGitHubReleaseEvent,
  context: TransformContext,
): PostTransformEvent {
  const release = payload.release;
  const refs: PostTransformReference[] = [];

  refs.push({
    type: "branch",
    id: release.target_commitish,
    url: `${payload.repository.html_url}/tree/${release.target_commitish}`,
    label: null,
  });

  const actionMap: Record<string, string> = {
    published: "Release Published",
    created: "Release Created",
    released: "Release Released",
  };

  const actionTitle = actionMap[payload.action] ?? `Release ${payload.action}`;
  const rawBody = release.body ?? "";

  const event: PostTransformEvent = {
    source: "github",
    sourceType: `release.${payload.action}`,
    sourceId: `release:${payload.repository.full_name}:${release.tag_name}`,
    title: sanitizeTitle(`[${actionTitle}] ${release.name ?? release.tag_name}`),
    body: sanitizeBody(rawBody),
    actor: {
      id: String(release.author.id),
      name: release.author.login,
      email: null,
      avatarUrl: release.author.avatar_url,
    },
    occurredAt: release.published_at ?? release.created_at,
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
      authorLogin: release.author.login,
      authorId: release.author.id,
    },
  };

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformGitHubRelease", event, validation.errors);
  }

  return event;
}

export function transformGitHubDiscussion(
  payload: PreTransformGitHubDiscussionEvent,
  context: TransformContext,
): PostTransformEvent {
  const discussion = payload.discussion;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "label", id: discussion.category.name, url: null, label: null });

  const actionMap: Record<string, string> = {
    created: "Discussion Created",
    answered: "Discussion Answered",
    closed: "Discussion Closed",
  };

  const actionTitle = actionMap[payload.action] ?? `Discussion ${payload.action}`;
  const rawBody = [discussion.title, discussion.body ?? ""].join("\n");

  const event: PostTransformEvent = {
    source: "github",
    sourceType: `discussion.${payload.action}`,
    sourceId: `discussion:${payload.repository.full_name}#${discussion.number}`,
    title: sanitizeTitle(`[${actionTitle}] ${discussion.title.slice(0, 100)}`),
    body: sanitizeBody(rawBody),
    actor: {
      id: String(discussion.user.id),
      name: discussion.user.login,
      email: null,
      avatarUrl: discussion.user.avatar_url,
    },
    occurredAt: discussion.updated_at,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      discussionNumber: discussion.number,
      action: payload.action,
      category: discussion.category.name,
      answered: discussion.answer_html_url !== null,
      authorLogin: discussion.user.login,
      authorId: discussion.user.id,
    },
  };

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformGitHubDiscussion", event, validation.errors);
  }

  return event;
}

function extractLinkedIssues(
  body: string,
): { id: string; url: string | null; label: string }[] {
  const matches: { id: string; url: string | null; label: string }[] = [];

  const githubPattern = /(fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
  let match;

  while ((match = githubPattern.exec(body)) !== null) {
    matches.push({
      id: `#${match[2]}`,
      url: null,
      label: match[1]?.toLowerCase().replace(/e?s$/, "") ?? "fixes",
    });
  }

  const externalPattern =
    /(fix(?:es)?|close[sd]?|resolve[sd]?)\s+(?:Sentry\s+)?([A-Z]+-\d+)/gi;

  while ((match = externalPattern.exec(body)) !== null) {
    matches.push({
      id: match[2] ?? "",
      url: null,
      label: match[1]?.toLowerCase().replace(/e?s$/, "") ?? "fixes",
    });
  }

  return matches;
}
