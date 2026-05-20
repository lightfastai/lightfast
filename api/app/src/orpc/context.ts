import type { AuthIdentity } from "../auth/identity";

export interface InitialContext {
  headers: Headers;
  requestId: string;
}

export type OrpcAuthIdentity = Extract<AuthIdentity, { type: "active" }>;

export interface AuthContext {
  apiKeyId: string;
  auth: {
    identity: OrpcAuthIdentity;
  };
}
