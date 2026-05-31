import type { AuthIdentity } from "../../auth/identity";

export const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

export const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

// Expired Clerk sessions normalize to unauthenticated at the identity boundary.
export const expiredSessionIdentity: AuthIdentity = {
  type: "unauthenticated",
};
