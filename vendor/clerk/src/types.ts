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

export interface LightfastLastActiveOrg {
  id: string;
  slug: string;
}

export interface LightfastSessionClaims {
  /** Last org Lightfast observed for post-auth routing. */
  last_active_org?: LightfastLastActiveOrg | null;
  /** Org binding-gate mirror. Absent/empty for orgs that have not bound. */
  lf_binding_status?: string;
}

/**
 * Lightfast-owned Clerk session claims.
 *
 * This lives in `@vendor/clerk` so every app importing the Clerk boundary sees
 * the same `auth().sessionClaims` shape.
 */
declare global {
  interface CustomJwtSessionClaims extends LightfastSessionClaims {}
}

/**
 * Lightfast-owned slice of a Clerk organization's `publicMetadata`.
 *
 * `publicMetadata` is intentional: the binding status is non-sensitive, clients
 * may read it, and Clerk mints it into the web session token as
 * `lf_binding_status`.
 * Sensitive or operational binding details (installation ids, provider tokens,
 * repo scopes) stay in the Lightfast DB and must never be written here.
 *
 * Missing metadata is treated as `unbound` by the web proxy.
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
} from "@clerk/shared/types";
