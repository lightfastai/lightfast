import type {
  EntityRelation,
  PostTransformEvent,
} from "../../post-transform-event";
import { sanitizeBody, sanitizeTitle } from "../../sanitize";
import type { TransformContext } from "../../types";
import {
  logValidationErrors,
  validatePostTransformEvent,
} from "../../validation";
import type {
  PreTransformGitHubDiscussionEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubPushEvent,
  PreTransformGitHubReleaseEvent,
} from "./schemas";

export function transformGitHubPush(
  payload: PreTransformGitHubPushEvent,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const branch = payload.ref.replace("refs/heads/", "");
  const repoId = String(payload.repository.id);

  const relations: EntityRelation[] = [
    {
      provider: "github",
      entityType: "branch",
      entityId: `${repoId}:${branch}`,
      title: branch,
      url: `${payload.repository.html_url}/tree/${branch}`,
      relationshipType: "pushed_to",
    },
  ];

  const fileCount = payload.commits.reduce(
    (sum, c) => sum + c.added.length + c.modified.length + c.removed.length,
    0
  );

  const rawTitle =
    payload.head_commit?.message.split("\n")[0]?.slice(0, 100) ??
    `Push to ${branch}`;

  const rawBody = payload.head_commit?.message ?? "";

  const event: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `github:commit:${payload.after}:push`,
    provider: "github",
    eventType: "push",
    title: sanitizeTitle(`[Push] ${rawTitle}`),
    body: sanitizeBody(rawBody),
    occurredAt: payload.head_commit?.timestamp ?? new Date().toISOString(),
    entity: {
      provider: "github",
      entityType: "commit",
      entityId: payload.after,
      title: rawTitle,
      url: `${payload.repository.html_url}/commit/${payload.after}`,
      state: null,
    },
    relations,
    attributes: {
      repoId: payload.repository.id,
      repoFullName: payload.repository.full_name,
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
  _eventType: string
): PostTransformEvent {
  const pr = payload.pull_request;
  const repoId = String(payload.repository.id);
  const effectiveAction =
    payload.action === "closed" && pr.merged ? "merged" : payload.action;

  const relations: EntityRelation[] = [];

  if (pr.head.sha) {
    relations.push({
      provider: "github",
      entityType: "commit",
      entityId: pr.head.sha,
      title: null,
      url: `${payload.repository.html_url}/commit/${pr.head.sha}`,
      relationshipType: "head_commit",
    });
  }

  if (pr.merge_commit_sha) {
    relations.push({
      provider: "github",
      entityType: "commit",
      entityId: pr.merge_commit_sha,
      title: null,
      url: `${payload.repository.html_url}/commit/${pr.merge_commit_sha}`,
      relationshipType: "merge_commit",
    });
  }

  relations.push({
    provider: "github",
    entityType: "branch",
    entityId: `${repoId}:${pr.head.ref}`,
    title: pr.head.ref,
    url: `${payload.repository.html_url}/tree/${pr.head.ref}`,
    relationshipType: "from_branch",
  });

  relations.push({
    provider: "github",
    entityType: "branch",
    entityId: `${repoId}:${pr.base.ref}`,
    title: pr.base.ref,
    url: `${payload.repository.html_url}/tree/${pr.base.ref}`,
    relationshipType: "to_branch",
  });

  const linkedIssues = extractLinkedIssues(
    pr.body ?? "",
    repoId,
    payload.repository.html_url
  );
  for (const issue of linkedIssues) {
    relations.push({
      provider: "github",
      entityType: "issue",
      entityId: issue.entityId,
      title: null,
      url: issue.url,
      relationshipType: issue.relationshipType,
    });
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

  const prState = pr.merged ? "merged" : pr.state;

  const event: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `github:pr:${repoId}#${pr.number}:pull-request.${effectiveAction}`,
    provider: "github",
    eventType: `pull-request.${effectiveAction}`,
    title: sanitizeTitle(`[${actionTitle}] ${pr.title.slice(0, 100)}`),
    body: sanitizeBody(rawBody),
    occurredAt: pr.updated_at,
    entity: {
      provider: "github",
      entityType: "pr",
      entityId: `${repoId}#${pr.number}`,
      title: pr.title,
      url: pr.html_url,
      state: prState,
    },
    relations,
    attributes: {
      repoId: payload.repository.id,
      repoFullName: payload.repository.full_name,
      prNumber: pr.number,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      isDraft: pr.draft,
      isMerged: pr.merged ?? false,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      headSha: pr.head.sha,
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
  _eventType: string
): PostTransformEvent {
  const issue = payload.issue;
  const repoId = String(payload.repository.id);

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
    deliveryId: context.deliveryId,
    sourceId: `github:issue:${repoId}#${issue.number}:issue.${payload.action}`,
    provider: "github",
    eventType: `issue.${payload.action}`,
    title: sanitizeTitle(`[${actionTitle}] ${issue.title.slice(0, 100)}`),
    body: sanitizeBody(rawBody),
    occurredAt: issue.updated_at,
    entity: {
      provider: "github",
      entityType: "issue",
      entityId: `${repoId}#${issue.number}`,
      title: issue.title,
      url: issue.html_url,
      state: issue.state,
    },
    relations: [],
    attributes: {
      repoId: payload.repository.id,
      repoFullName: payload.repository.full_name,
      issueNumber: issue.number,
      action: payload.action,
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
  _eventType: string
): PostTransformEvent {
  const release = payload.release;
  const repoId = String(payload.repository.id);

  const relations: EntityRelation[] = [
    {
      provider: "github",
      entityType: "branch",
      entityId: `${repoId}:${release.target_commitish}`,
      title: release.target_commitish,
      url: `${payload.repository.html_url}/tree/${release.target_commitish}`,
      relationshipType: "from_branch",
    },
  ];

  const actionMap: Record<string, string> = {
    published: "Release Published",
    created: "Release Created",
    released: "Release Released",
  };

  const actionTitle = actionMap[payload.action] ?? `Release ${payload.action}`;
  const rawBody = release.body ?? "";

  const event: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `github:release:${repoId}:${release.tag_name}:release.${payload.action}`,
    provider: "github",
    eventType: `release.${payload.action}`,
    title: sanitizeTitle(
      `[${actionTitle}] ${release.name ?? release.tag_name}`
    ),
    body: sanitizeBody(rawBody),
    occurredAt: release.published_at ?? release.created_at,
    entity: {
      provider: "github",
      entityType: "release",
      entityId: `${repoId}:${release.tag_name}`,
      title: release.name ?? release.tag_name,
      url: release.html_url ?? null,
      state: release.draft
        ? "draft"
        : release.prerelease
          ? "prerelease"
          : "published",
    },
    relations,
    attributes: {
      repoId: payload.repository.id,
      repoFullName: payload.repository.full_name,
      tagName: release.tag_name,
      targetCommitish: release.target_commitish,
      action: payload.action,
      prerelease: release.prerelease,
      isDraft: release.draft,
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
  _eventType: string
): PostTransformEvent {
  const discussion = payload.discussion;
  const repoId = String(payload.repository.id);

  const actionMap: Record<string, string> = {
    created: "Discussion Created",
    answered: "Discussion Answered",
    closed: "Discussion Closed",
  };

  const actionTitle =
    actionMap[payload.action] ?? `Discussion ${payload.action}`;
  const rawBody = [discussion.title, discussion.body ?? ""].join("\n");

  const event: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `github:discussion:${repoId}#${discussion.number}:discussion.${payload.action}`,
    provider: "github",
    eventType: `discussion.${payload.action}`,
    title: sanitizeTitle(`[${actionTitle}] ${discussion.title.slice(0, 100)}`),
    body: sanitizeBody(rawBody),
    occurredAt: discussion.updated_at,
    entity: {
      provider: "github",
      entityType: "discussion",
      entityId: `${repoId}#${discussion.number}`,
      title: discussion.title,
      url: discussion.html_url ?? null,
      state: discussion.answer_html_url !== null ? "answered" : "open",
    },
    relations: [],
    attributes: {
      repoId: payload.repository.id,
      repoFullName: payload.repository.full_name,
      discussionNumber: discussion.number,
      action: payload.action,
      category: discussion.category.name,
      answered: discussion.answer_html_url !== null,
    },
  };

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformGitHubDiscussion", event, validation.errors);
  }

  return event;
}

const LINKED_ISSUE_KEYWORD_MAP: Record<string, string> = {
  fix: "fixes",
  fixes: "fixes",
  close: "closes",
  closed: "closes",
  closes: "closes",
  resolve: "resolves",
  resolved: "resolves",
  resolves: "resolves",
};

function extractLinkedIssues(
  body: string,
  repoId: string,
  repoUrl: string
): { entityId: string; url: string | null; relationshipType: string }[] {
  const matches: {
    entityId: string;
    url: string | null;
    relationshipType: string;
  }[] = [];

  const githubPattern = /(fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
  let match;

  while ((match = githubPattern.exec(body)) !== null) {
    const issueNumber = match[2];
    if (issueNumber) {
      matches.push({
        entityId: `${repoId}#${issueNumber}`,
        url: `${repoUrl}/issues/${issueNumber}`,
        relationshipType:
          LINKED_ISSUE_KEYWORD_MAP[match[1]?.toLowerCase() ?? ""] ?? "fixes",
      });
    }
  }

  return matches;
}
