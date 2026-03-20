import type { CategoryDef } from "../provider/kinds";
import type { ProviderSlug } from "./display";

export type { CategoryDef } from "../provider/kinds";

export const PROVIDER_CATEGORIES: Record<
  ProviderSlug,
  Record<string, CategoryDef>
> = {
  github: {
    pull_request: {
      label: "Pull Requests",
      description: "Capture PR opens, merges, closes, and reopens",
      type: "observation",
    },
    issues: {
      label: "Issues",
      description: "Capture issue opens, closes, and reopens",
      type: "observation",
    },
  },
  linear: {
    Issue: {
      label: "Issues",
      description: "Capture issue creates, updates, and deletes",
      type: "observation",
    },
    Comment: {
      label: "Comments",
      description: "Capture comment activity on issues",
      type: "observation",
    },
    IssueLabel: {
      label: "Issue Labels",
      description: "Capture issue label changes",
      type: "observation",
    },
    Project: {
      label: "Projects",
      description: "Capture project lifecycle events",
      type: "observation",
    },
    Cycle: {
      label: "Cycles",
      description: "Capture sprint/cycle lifecycle events",
      type: "observation",
    },
    ProjectUpdate: {
      label: "Project Updates",
      description: "Capture project status updates",
      type: "observation",
    },
  },
  sentry: {
    issue: {
      label: "Issues",
      description:
        "Capture issue state changes (created, resolved, assigned, ignored)",
      type: "observation",
    },
    error: {
      label: "Errors",
      description: "Capture individual error events",
      type: "observation",
    },
    comment: {
      label: "Comments",
      description: "Capture issue comment activity",
      type: "observation",
    },
    event_alert: {
      label: "Event Alerts",
      description: "Capture event alert rule triggers",
      type: "observation",
    },
    metric_alert: {
      label: "Metric Alerts",
      description: "Capture metric alert triggers and resolutions",
      type: "observation",
    },
  },
  vercel: {
    "deployment.created": {
      label: "Deployment Started",
      description: "Capture when new deployments begin",
      type: "observation",
    },
    "deployment.succeeded": {
      label: "Deployment Succeeded",
      description: "Capture successful deployment completions",
      type: "observation",
    },
    "deployment.ready": {
      label: "Deployment Ready",
      description: "Capture when deployments are live",
      type: "observation",
    },
    "deployment.error": {
      label: "Deployment Failed",
      description: "Capture deployment failures",
      type: "observation",
    },
    "deployment.canceled": {
      label: "Deployment Canceled",
      description: "Capture canceled deployments",
      type: "observation",
    },
    "deployment.check-rerequested": {
      label: "Check Re-requested",
      description: "Capture deployment check re-request events",
      type: "observation",
    },
  },
  apollo: {},
} as const satisfies Record<ProviderSlug, Record<string, CategoryDef>>;
