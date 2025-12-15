import { z } from "zod";

/**
 * Workspace API Key Validation Schemas
 *
 * These schemas are used for workspace-scoped API key management.
 * Keys are bound to specific workspaces for secure, isolated access.
 */

/**
 * Schema for creating a new workspace API key
 */
export const createWorkspaceApiKeySchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(100),
  expiresAt: z.coerce.date().optional(),
});

/**
 * Schema for revoking (soft delete) an API key
 */
export const revokeWorkspaceApiKeySchema = z.object({
  keyId: z.string().min(1), // publicId
});

/**
 * Schema for permanently deleting an API key
 */
export const deleteWorkspaceApiKeySchema = z.object({
  keyId: z.string().min(1), // publicId
});

/**
 * Schema for rotating an API key (revoke old, create new)
 */
export const rotateWorkspaceApiKeySchema = z.object({
  keyId: z.string().min(1), // publicId
  expiresAt: z.coerce.date().optional(),
});

/**
 * Schema for listing workspace API keys
 */
export const listWorkspaceApiKeysSchema = z.object({
  workspaceId: z.string().min(1),
});

// Type exports
export type CreateWorkspaceApiKey = z.infer<typeof createWorkspaceApiKeySchema>;
export type RevokeWorkspaceApiKey = z.infer<typeof revokeWorkspaceApiKeySchema>;
export type DeleteWorkspaceApiKey = z.infer<typeof deleteWorkspaceApiKeySchema>;
export type RotateWorkspaceApiKey = z.infer<typeof rotateWorkspaceApiKeySchema>;
export type ListWorkspaceApiKeys = z.infer<typeof listWorkspaceApiKeysSchema>;
