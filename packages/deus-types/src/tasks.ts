/**
 * Shared task severity and status definitions for Deus code review tasks.
 */

export const TASK_SEVERITY = ["info", "warning", "error", "critical"] as const;

export type TaskSeverity = (typeof TASK_SEVERITY)[number];

export const TASK_STATUS = ["open", "resolved", "dismissed"] as const;

export type TaskStatus = (typeof TASK_STATUS)[number];

export type TaskMetadata = {
  githubCommentId?: string;
  filePath?: string;
  line?: number;
  startLine?: number;
  endLine?: number;
  codeSnippet?: string;
  suggestion?: string;
  category?: string;
};
