export const SessionType = {
  User: "user",
  Server: "server",
} as const;
export type SessionType = (typeof SessionType)[keyof typeof SessionType];

export interface AuthSession {
  type: (typeof SessionType)["User"];
  user: {
    id: string;
    accessToken: string;
    refreshToken: string;
  };
}

export interface ServerSession {
  type: (typeof SessionType)["Server"];
}

export type Session = AuthSession | ServerSession;

/**
 * Lightfast-owned slice of a Clerk organization's `publicMetadata`.
 *
 * `publicMetadata` is intentional: the binding status is non-sensitive, clients
 * may read it, and Clerk mints it into session/JWT claims as `lf_binding_status`.
 * Sensitive or operational binding details (installation ids, provider tokens,
 * repo scopes) stay in the Lightfast DB and must never be written here.
 *
 * Missing metadata is treated as `unbound` by every consumer.
 */
export interface LightfastOrgPublicMetadata {
  lightfast?: {
    binding?: {
      status?: "bound" | "unbound" | "revoked";
      provider?: "github";
      updatedAt?: string;
    };
  };
}

export type {
  ClerkAPIError,
  EmailCodeFactor,
  OAuthStrategy,
} from "@clerk/shared/types";
