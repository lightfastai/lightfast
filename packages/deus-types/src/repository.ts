import type { CodeReviewTool } from "./code-review";

/**
 * Repository level shared types.
 */

export type RepositoryPermissions = {
  admin: boolean;
  push: boolean;
  pull: boolean;
};

export type CodeReviewSettings = {
  enabled?: boolean;
  tool?: CodeReviewTool;
  command?: string;
};

export type RepositoryMetadata = {
  fullName?: string;
  description?: string;
  language?: string;
  private?: boolean;
  owner?: string;
  ownerAvatar?: string;
  stargazersCount?: number;
  updatedAt?: string;
  deleted?: boolean;
  deletedAt?: string;
  extras?: Record<string, unknown>;
};
