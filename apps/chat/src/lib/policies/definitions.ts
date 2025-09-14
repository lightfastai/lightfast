import type { RouteContext } from "./types";

// Derived types from policies (single source of truth)
export type UserTier = "anonymous" | "auth_user";
export type AuthContext = 
  | ({ type: "anonymous"; userId: string } & RouteContext)
  | ({ type: "auth_user"; authenticatedUserId: string; userId: string } & RouteContext);