/**
 * Repository level shared types.
 */

export interface RepositoryPermissions {
  admin: boolean;
  pull: boolean;
  push: boolean;
}

export interface RepositoryMetadata {
  deleted?: boolean;
  deletedAt?: string;
  description?: string;
  extras?: Record<string, unknown>;
  fullName?: string;
  language?: string;
  owner?: string;
  ownerAvatar?: string;
  private?: boolean;
  stargazersCount?: number;
  updatedAt?: string;
}
