import { createClerkClient } from "@clerk/backend";

export type { ClerkClient } from "@clerk/backend";

export function createBackendClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey?.startsWith("sk_")) {
    throw new Error("CLERK_SECRET_KEY is required to create a Clerk client.");
  }

  return createClerkClient({ secretKey });
}
