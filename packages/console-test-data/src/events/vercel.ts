/**
 * Vercel Event Builders
 *
 * Pure functions that build SourceEvent objects matching the output
 * of Vercel webhook transformers in console-webhooks.
 */

import type { SourceEvent, SourceReference } from "@repo/console-types";

// ============ Helper Functions ============

const generateId = (): string => {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let id = "";
  for (let i = 0; i < 20; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

const calculateOccurredAt = (daysAgo = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

// ============ Builder Options ============

export interface VercelDeploymentOptions {
  projectName: string;
  projectId?: string;
  event: "deployment.created" | "deployment.succeeded" | "deployment.ready" | "deployment.error" | "deployment.canceled";
  branch?: string;
  commitMessage?: string;
  commitAuthor?: string;
  environment?: "production" | "preview";
  daysAgo?: number;
}

// ============ Event Builders ============

/**
 * Build a Vercel deployment event
 * Matches output of transformVercelDeployment in console-webhooks
 */
export const vercelDeployment = (opts: VercelDeploymentOptions): SourceEvent => {
  const branch = opts.branch ?? "main";
  const deploymentId = `dpl_${generateId()}`;
  const projectId = opts.projectId ?? `prj_${generateId()}`;
  const commitSha = generateId();

  const eventTitleMap: Record<string, string> = {
    "deployment.created": "Deployment Started",
    "deployment.succeeded": "Deployment Succeeded",
    "deployment.ready": "Deployment Ready",
    "deployment.error": "Deployment Failed",
    "deployment.canceled": "Deployment Canceled",
  };

  const refs: SourceReference[] = [
    { type: "deployment", id: deploymentId },
    { type: "project", id: projectId },
    { type: "branch", id: branch },
  ];

  if (commitSha) {
    refs.push({ type: "commit", id: commitSha });
  }

  const emoji = opts.event === "deployment.succeeded" || opts.event === "deployment.ready"
    ? "+"
    : opts.event === "deployment.error"
      ? "x"
      : ">";

  return {
    source: "vercel",
    sourceType: opts.event,
    sourceId: `deployment:${deploymentId}`,
    title: `[${eventTitleMap[opts.event]}] ${opts.projectName} from ${branch}`,
    body: `${emoji} ${eventTitleMap[opts.event]}\n${opts.commitMessage ?? ""}`,
    actor: opts.commitAuthor
      ? { id: `github:${opts.commitAuthor}`, name: opts.commitAuthor }
      : undefined,
    occurredAt: calculateOccurredAt(opts.daysAgo),
    references: refs,
    metadata: {
      testData: true,
      deploymentId,
      projectId,
      projectName: opts.projectName,
      environment: opts.environment ?? "preview",
      branch,
      gitCommitSha: commitSha,
      gitCommitMessage: opts.commitMessage,
    },
  };
};
