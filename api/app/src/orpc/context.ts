export interface InitialContext {
  headers: Headers;
  requestId: string;
}

export interface AuthContext {
  apiKeyId: string;
  clerkOrgId: string;
  userId: string;
}
