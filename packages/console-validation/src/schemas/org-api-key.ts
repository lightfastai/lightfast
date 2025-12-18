import { z } from "zod";

/**
 * Organization API Key Validation Schemas
 *
 * These schemas are used for organization-scoped API key management.
 * Keys are bound to specific workspaces for secure, isolated access.
 */

/**
 * Schema for creating a new organization API key
 */
export const createOrgApiKeySchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(100),
  expiresAt: z.coerce.date().optional(),
});

/**
 * Schema for revoking (soft delete) an API key
 */
export const revokeOrgApiKeySchema = z.object({
  keyId: z.string().min(1), // publicId
});

/**
 * Schema for permanently deleting an API key
 */
export const deleteOrgApiKeySchema = z.object({
  keyId: z.string().min(1), // publicId
});

/**
 * Schema for rotating an API key (revoke old, create new)
 */
export const rotateOrgApiKeySchema = z.object({
  keyId: z.string().min(1), // publicId
  expiresAt: z.coerce.date().optional(),
});

/**
 * Schema for listing organization API keys
 */
export const listOrgApiKeysSchema = z.object({
  workspaceId: z.string().min(1),
});

// Type exports
export type CreateOrgApiKey = z.infer<typeof createOrgApiKeySchema>;
export type RevokeOrgApiKey = z.infer<typeof revokeOrgApiKeySchema>;
export type DeleteOrgApiKey = z.infer<typeof deleteOrgApiKeySchema>;
export type RotateOrgApiKey = z.infer<typeof rotateOrgApiKeySchema>;
export type ListOrgApiKeys = z.infer<typeof listOrgApiKeysSchema>;

// Backward compatibility exports
/** @deprecated Use createOrgApiKeySchema instead */
export const createWorkspaceApiKeySchema = createOrgApiKeySchema;
/** @deprecated Use revokeOrgApiKeySchema instead */
export const revokeWorkspaceApiKeySchema = revokeOrgApiKeySchema;
/** @deprecated Use deleteOrgApiKeySchema instead */
export const deleteWorkspaceApiKeySchema = deleteOrgApiKeySchema;
/** @deprecated Use rotateOrgApiKeySchema instead */
export const rotateWorkspaceApiKeySchema = rotateOrgApiKeySchema;
/** @deprecated Use listOrgApiKeysSchema instead */
export const listWorkspaceApiKeysSchema = listOrgApiKeysSchema;

/** @deprecated Use CreateOrgApiKey instead */
export type CreateWorkspaceApiKey = CreateOrgApiKey;
/** @deprecated Use RevokeOrgApiKey instead */
export type RevokeWorkspaceApiKey = RevokeOrgApiKey;
/** @deprecated Use DeleteOrgApiKey instead */
export type DeleteWorkspaceApiKey = DeleteOrgApiKey;
/** @deprecated Use RotateOrgApiKey instead */
export type RotateWorkspaceApiKey = RotateOrgApiKey;
/** @deprecated Use ListOrgApiKeys instead */
export type ListWorkspaceApiKeys = ListOrgApiKeys;
