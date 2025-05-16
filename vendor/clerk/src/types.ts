export enum SessionType {
  User = "user",
  Server = "server",
}

export interface AuthSession {
  user: {
    id: string;
    clerkId: string;
  };
  type: SessionType.User;
}

export interface ServerSession {
  type: SessionType.Server;
}

export type Session = AuthSession | ServerSession;

export type { ClerkAPIError } from "@clerk/types";
