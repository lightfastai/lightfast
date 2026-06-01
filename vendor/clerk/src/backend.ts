import { createClerkClient } from "@clerk/backend";

import { clerkEnvBase } from "./env";

export type { ClerkClient } from "@clerk/backend";

export function createBackendClerkClient() {
  const secretKey = clerkEnvBase.CLERK_SECRET_KEY;
  if (!secretKey?.startsWith("sk_")) {
    throw new Error("CLERK_SECRET_KEY is required to create a Clerk client.");
  }

  return createClerkClient({ secretKey });
}
