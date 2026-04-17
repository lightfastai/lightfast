import type { ProviderSlug } from "./display";

export type EventLabelKey = `${ProviderSlug}:${string}`;

export const EVENT_LABELS: Record<string, string> = {
  // GitHub
  "github:pull_request.opened": "PR Opened",
  "github:pull_request.closed": "PR Closed",
  "github:pull_request.merged": "PR Merged",
  "github:pull_request.reopened": "PR Reopened",
  "github:pull_request.ready-for-review": "Ready for Review",
  "github:issues.opened": "Issue Opened",
  "github:issues.closed": "Issue Closed",
  "github:issues.reopened": "Issue Reopened",
  "github:issue_comment.created": "Comment Added",
  "github:issue_comment.edited": "Comment Edited",
  "github:issue_comment.deleted": "Comment Deleted",
  // Linear
  "linear:Issue.created": "Issue Created",
  "linear:Issue.updated": "Issue Updated",
  "linear:Issue.deleted": "Issue Deleted",
  "linear:Comment.created": "Comment Added",
  "linear:Comment.updated": "Comment Updated",
  "linear:Comment.deleted": "Comment Deleted",
  "linear:Project.created": "Project Created",
  "linear:Project.updated": "Project Updated",
  "linear:Project.deleted": "Project Deleted",
  "linear:Cycle.created": "Cycle Created",
  "linear:Cycle.updated": "Cycle Updated",
  "linear:Cycle.deleted": "Cycle Deleted",
  "linear:ProjectUpdate.created": "Project Update Posted",
  "linear:ProjectUpdate.updated": "Project Update Edited",
  "linear:ProjectUpdate.deleted": "Project Update Deleted",
  // Sentry
  "sentry:issue.created": "Issue Created",
  "sentry:issue.resolved": "Issue Resolved",
  "sentry:issue.assigned": "Issue Assigned",
  "sentry:issue.ignored": "Issue Ignored",
  "sentry:issue.archived": "Issue Archived",
  "sentry:issue.unresolved": "Issue Unresolved",
  "sentry:error": "Errors",
  "sentry:event_alert": "Event Alerts",
  "sentry:metric_alert": "Metric Alerts",
  // Vercel
  "vercel:deployment.created": "Deployment Started",
  "vercel:deployment.succeeded": "Deployment Succeeded",
  "vercel:deployment.ready": "Deployment Ready",
  "vercel:deployment.error": "Deployment Failed",
  "vercel:deployment.canceled": "Deployment Canceled",
  "vercel:deployment.check-rerequested": "Deployment Check Re-requested",
} as const;
