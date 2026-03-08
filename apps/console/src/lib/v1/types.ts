/**
 * Shared types for v1 API logic functions
 */

/** Auth context available to all v1 logic functions */
export interface V1AuthContext {
  apiKeyId?: string;
  authType: "api-key" | "session";
  userId: string;
  workspaceId: string;
}
