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

export type {
  ClerkAPIError,
  EmailCodeFactor,
  OAuthStrategy,
} from "@clerk/shared/types";
