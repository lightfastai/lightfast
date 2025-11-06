/**
 * Repository level shared types.
 */

export interface RepositoryPermissions {
  admin: boolean;
  push: boolean;
  pull: boolean;
}

export interface RepositoryMetadata {
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
}
