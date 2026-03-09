export enum SessionType {
  User = "user",
  Server = "server",
}

export interface AuthSession {
  type: SessionType.User;
  user: {
    id: string;
    accessToken: string;
    refreshToken: string;
  };
}

export interface ServerSession {
  type: SessionType.Server;
}

export type Session = AuthSession | ServerSession;

export type {
  ClerkAPIError,
  EmailCodeFactor,
  OAuthStrategy,
} from "@clerk/shared/types";
