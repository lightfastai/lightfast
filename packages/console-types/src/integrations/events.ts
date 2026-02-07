// Supported events by provider
export const GITHUB_EVENTS = {
  push: {
    label: "Push",
    description: "Sync files and capture observations when code is pushed",
    type: "sync+observation" as const,
  },
  pull_request: {
    label: "Pull Requests",
    description: "Capture PR opens, merges, closes, and reopens",
    type: "observation" as const,
  },
  issues: {
    label: "Issues",
    description: "Capture issue opens, closes, and reopens",
    type: "observation" as const,
  },
  release: {
    label: "Releases",
    description: "Capture published releases",
    type: "observation" as const,
  },
  discussion: {
    label: "Discussions",
    description: "Capture discussion threads and answers",
    type: "observation" as const,
  },
} as const;

export const VERCEL_EVENTS = {
  "deployment.created": {
    label: "Deployment Started",
    description: "Capture when new deployments begin",
    type: "observation" as const,
  },
  "deployment.succeeded": {
    label: "Deployment Succeeded",
    description: "Capture successful deployment completions",
    type: "observation" as const,
  },
  "deployment.ready": {
    label: "Deployment Ready",
    description: "Capture when deployments are live",
    type: "observation" as const,
  },
  "deployment.error": {
    label: "Deployment Failed",
    description: "Capture deployment failures",
    type: "observation" as const,
  },
  "deployment.canceled": {
    label: "Deployment Canceled",
    description: "Capture canceled deployments",
    type: "observation" as const,
  },
} as const;

export const SENTRY_EVENTS = {
  issue: {
    label: "Issues",
    description: "Capture issue state changes (created, resolved, assigned, ignored)",
    type: "observation" as const,
  },
  error: {
    label: "Errors",
    description: "Capture individual error events",
    type: "observation" as const,
  },
  event_alert: {
    label: "Event Alerts",
    description: "Capture event alert rule triggers",
    type: "observation" as const,
  },
  metric_alert: {
    label: "Metric Alerts",
    description: "Capture metric alert triggers and resolutions",
    type: "observation" as const,
  },
} as const;

export const LINEAR_EVENTS = {
  Issue: {
    label: "Issues",
    description: "Capture issue creates, updates, and deletes",
    type: "observation" as const,
  },
  Comment: {
    label: "Comments",
    description: "Capture comment activity on issues",
    type: "observation" as const,
  },
  Project: {
    label: "Projects",
    description: "Capture project lifecycle events",
    type: "observation" as const,
  },
  Cycle: {
    label: "Cycles",
    description: "Capture sprint/cycle lifecycle events",
    type: "observation" as const,
  },
  ProjectUpdate: {
    label: "Project Updates",
    description: "Capture project status updates",
    type: "observation" as const,
  },
} as const;

export type GitHubEvent = keyof typeof GITHUB_EVENTS;
export type VercelEvent = keyof typeof VERCEL_EVENTS;
export type SentryEvent = keyof typeof SENTRY_EVENTS;
export type LinearEvent = keyof typeof LINEAR_EVENTS;

export const ALL_GITHUB_EVENTS = Object.keys(GITHUB_EVENTS) as GitHubEvent[];
export const ALL_VERCEL_EVENTS = Object.keys(VERCEL_EVENTS) as VercelEvent[];
export const ALL_SENTRY_EVENTS = Object.keys(SENTRY_EVENTS) as SentryEvent[];
export const ALL_LINEAR_EVENTS = Object.keys(LINEAR_EVENTS) as LinearEvent[];
