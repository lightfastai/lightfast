export interface AuthContext {
  apiKeyId?: string;
  authType: "api-key" | "session";
  clerkOrgId: string;
  userId: string;
}
