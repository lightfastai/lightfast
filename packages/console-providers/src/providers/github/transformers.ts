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
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubPullRequestEvent,
} from "./schemas";

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
