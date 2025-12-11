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

export type GitHubEvent = keyof typeof GITHUB_EVENTS;
export type VercelEvent = keyof typeof VERCEL_EVENTS;

export const ALL_GITHUB_EVENTS = Object.keys(GITHUB_EVENTS) as GitHubEvent[];
export const ALL_VERCEL_EVENTS = Object.keys(VERCEL_EVENTS) as VercelEvent[];
