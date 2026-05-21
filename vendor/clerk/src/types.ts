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

export type { ClerkAPIError, EmailCodeFactor } from "@clerk/shared/types";
