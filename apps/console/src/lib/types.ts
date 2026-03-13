export interface AuthContext {
  apiKeyId?: string;
  authType: "api-key" | "session";
  userId: string;
  workspaceId: string;
}
