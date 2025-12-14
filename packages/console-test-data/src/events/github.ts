/**
 * GitHub Event Builders
 *
 * Pure functions that build SourceEvent objects matching the output
 * of GitHub webhook transformers in console-webhooks.
 */

import type { SourceEvent, SourceActor, SourceReference } from "@repo/console-types";

// ============ Helper Functions ============

const generateId = (): string => {
  const chars = "0123456789abcdef";
  let id = "";
  for (let i = 0; i < 40; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

const calculateOccurredAt = (daysAgo = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

const buildActor = (name: string, email?: string): SourceActor => ({
  id: `github:${name}`,
  name,
  email,
});

// ============ Builder Options ============

export interface GitHubPushOptions {
  repo: string;                    // e.g., "lightfastai/lightfast"
  branch?: string;                 // default: "main"
  commitMessage: string;
  author: string;
  authorEmail?: string;
  filesChanged?: number;
  daysAgo?: number;                // for occurredAt calculation
}

export interface GitHubPROptions {
  repo: string;
  prNumber: number;
  title: string;
  body?: string;
  action: "opened" | "closed" | "merged" | "reopened" | "ready_for_review";
  author: string;
  headBranch?: string;
  baseBranch?: string;
  additions?: number;
  deletions?: number;
  linkedIssues?: string[];         // e.g., ["#123", "#456"]
  labels?: string[];
  reviewers?: string[];
  daysAgo?: number;
}

export interface GitHubIssueOptions {
  repo: string;
  issueNumber: number;
  title: string;
  body?: string;
  action: "opened" | "closed" | "reopened";
  author: string;
  labels?: string[];
  assignees?: string[];
  daysAgo?: number;
}

// ============ Event Builders ============

/**
 * Build a GitHub push event
 * Matches output of transformGitHubPush in console-webhooks
 */
export const githubPush = (opts: GitHubPushOptions): SourceEvent => {
  const branch = opts.branch ?? "main";
  const commitSha = generateId();

  const refs: SourceReference[] = [
    { type: "commit", id: commitSha, url: `https://github.com/${opts.repo}/commit/${commitSha}` },
    { type: "branch", id: branch, url: `https://github.com/${opts.repo}/tree/${branch}` },
  ];

  return {
    source: "github",
    sourceType: "push",
    sourceId: `push:${opts.repo}:${commitSha}`,
    title: `[Push] ${opts.commitMessage.split("\n")[0]?.slice(0, 100) ?? "Push"}`,
    body: opts.commitMessage,
    actor: buildActor(opts.author, opts.authorEmail),
    occurredAt: calculateOccurredAt(opts.daysAgo),
    references: refs,
    metadata: {
      testData: true,
      repoFullName: opts.repo,
      repoId: Math.floor(Math.random() * 1000000),
      branch,
      afterSha: commitSha,
      fileCount: opts.filesChanged ?? 1,
    },
  };
};

/**
 * Build a GitHub pull request event
 * Matches output of transformGitHubPullRequest in console-webhooks
 */
export const githubPR = (opts: GitHubPROptions): SourceEvent => {
  const headBranch = opts.headBranch ?? "feature-branch";
  const baseBranch = opts.baseBranch ?? "main";
  const headSha = generateId();

  const actionTitleMap: Record<string, string> = {
    opened: "PR Opened",
    closed: "PR Closed",
    merged: "PR Merged",
    reopened: "PR Reopened",
    ready_for_review: "Ready for Review",
  };

  const refs: SourceReference[] = [
    { type: "pr", id: `#${opts.prNumber}`, url: `https://github.com/${opts.repo}/pull/${opts.prNumber}` },
    { type: "branch", id: headBranch, url: `https://github.com/${opts.repo}/tree/${headBranch}` },
    { type: "commit", id: headSha, url: `https://github.com/${opts.repo}/commit/${headSha}` },
  ];

  // Add linked issues
  for (const issue of opts.linkedIssues ?? []) {
    refs.push({ type: "issue", id: issue, label: "fixes" });
  }

  // Add labels
  for (const label of opts.labels ?? []) {
    refs.push({ type: "label", id: label });
  }

  // Add reviewers
  for (const reviewer of opts.reviewers ?? []) {
    refs.push({ type: "reviewer", id: reviewer, url: `https://github.com/${reviewer}` });
  }

  const sourceType = opts.action === "merged"
    ? "pull-request.merged"
    : `pull-request.${opts.action}`;

  return {
    source: "github",
    sourceType,
    sourceId: `pr:${opts.repo}#${opts.prNumber}:${opts.action}`,
    title: `[${actionTitleMap[opts.action]}] ${opts.title.slice(0, 100)}`,
    body: [opts.title, opts.body ?? ""].join("\n"),
    actor: buildActor(opts.author),
    occurredAt: calculateOccurredAt(opts.daysAgo),
    references: refs,
    metadata: {
      testData: true,
      repoFullName: opts.repo,
      repoId: Math.floor(Math.random() * 1000000),
      prNumber: opts.prNumber,
      action: opts.action,
      merged: opts.action === "merged",
      additions: opts.additions ?? 50,
      deletions: opts.deletions ?? 20,
      headRef: headBranch,
      baseRef: baseBranch,
      headSha,
    },
  };
};

/**
 * Build a GitHub issue event
 * Matches output of transformGitHubIssue in console-webhooks
 */
export const githubIssue = (opts: GitHubIssueOptions): SourceEvent => {
  const actionTitleMap: Record<string, string> = {
    opened: "Issue Opened",
    closed: "Issue Closed",
    reopened: "Issue Reopened",
  };

  const refs: SourceReference[] = [
    { type: "issue", id: `#${opts.issueNumber}`, url: `https://github.com/${opts.repo}/issues/${opts.issueNumber}` },
  ];

  for (const label of opts.labels ?? []) {
    refs.push({ type: "label", id: label });
  }

  for (const assignee of opts.assignees ?? []) {
    refs.push({ type: "assignee", id: assignee, url: `https://github.com/${assignee}` });
  }

  return {
    source: "github",
    sourceType: `issue.${opts.action}`,
    sourceId: `issue:${opts.repo}#${opts.issueNumber}:${opts.action}`,
    title: `[${actionTitleMap[opts.action]}] ${opts.title.slice(0, 100)}`,
    body: [opts.title, opts.body ?? ""].join("\n"),
    actor: buildActor(opts.author),
    occurredAt: calculateOccurredAt(opts.daysAgo),
    references: refs,
    metadata: {
      testData: true,
      repoFullName: opts.repo,
      repoId: Math.floor(Math.random() * 1000000),
      issueNumber: opts.issueNumber,
      action: opts.action,
    },
  };
};
