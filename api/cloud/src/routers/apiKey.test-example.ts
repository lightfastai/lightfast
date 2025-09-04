/**
 * Example test file showing how to use the apiKey router
 * This file demonstrates the API structure and expected responses
 */

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { apiKeyRouter } from "./apiKey";

// Type inference for inputs
type RouterInput = inferRouterInputs<typeof apiKeyRouter>;
type RouterOutput = inferRouterOutputs<typeof apiKeyRouter>;

// Example input types
type CreateInput = RouterInput["create"];
type ListInput = RouterInput["list"];
type RevokeInput = RouterInput["revoke"];
type ValidateInput = RouterInput["validate"];
type DeleteInput = RouterInput["delete"];

// Example output types
type CreateOutput = RouterOutput["create"];
type ListOutput = RouterOutput["list"];
type RevokeOutput = RouterOutput["revoke"];
type ValidateOutput = RouterOutput["validate"];
type DeleteOutput = RouterOutput["delete"];

// Example usage patterns:

// 1. Creating a new API key (protected procedure - requires authentication)
const createExample: CreateInput = {
  name: "Production CLI Key",
  expiresInDays: 90, // Optional: key expires in 90 days
};

// Expected response:
const createResponse: CreateOutput = {
  id: "uuid-here",
  name: "Production CLI Key",
  keyPreview: "...abcd",
  createdAt: "2024-01-01T00:00:00.000Z",
  expiresAt: "2024-04-01T00:00:00.000Z",
  key: "lf_32CharacterSecureKeyHere123456", // Only returned during creation!
  message: "Store this key securely. You won't be able to see it again.",
};

// 2. Listing API keys (protected procedure)
const listExample: ListInput = {
  includeInactive: false, // Optional: defaults to false
};

// Expected response:
const listResponse: ListOutput = [
  {
    id: "uuid-here",
    name: "Production CLI Key",
    keyPreview: "...abcd",
    active: true,
    lastUsedAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2024-04-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    isExpired: false,
  },
];

// 3. Revoking an API key (protected procedure)
const revokeExample: RevokeInput = {
  keyId: "uuid-here",
};

// Expected response:
const revokeResponse: RevokeOutput = {
  success: true,
  message: 'API key "Production CLI Key" has been revoked',
  revokedKey: {
    id: "uuid-here",
    name: "Production CLI Key",
  },
};

// 4. Validating an API key (public procedure - for CLI authentication)
const validateExample: ValidateInput = {
  key: "lf_32CharacterSecureKeyHere123456",
};

// Expected response:
const validateResponse: ValidateOutput = {
  valid: true,
  userId: "clerk_user_id_here",
  keyId: "uuid-here",
};

// 5. Permanently deleting a revoked key (protected procedure)
const deleteExample: DeleteInput = {
  keyId: "uuid-here",
};

// Expected response:
const deleteResponse: DeleteOutput = {
  success: true,
  message: 'API key "Production CLI Key" has been permanently deleted',
};

// Error handling examples:

// 1. Invalid API key format
// Input: { key: "invalid_key" }
// Error: TRPCError with message "API key must start with lf_"

// 2. Expired API key
// Error: TRPCError with code "UNAUTHORIZED" and message "API key has expired"

// 3. Trying to delete an active key
// Error: TRPCError with code "BAD_REQUEST" and message "Cannot delete an active API key. Please revoke it first."

// 4. Key not found or permission denied
// Error: TRPCError with code "NOT_FOUND" and message "API key not found or you don't have permission to revoke it"

export type {
  CreateInput,
  CreateOutput,
  DeleteInput,
  DeleteOutput,
  ListInput,
  ListOutput,
  RevokeInput,
  RevokeOutput,
  ValidateInput,
  ValidateOutput,
};