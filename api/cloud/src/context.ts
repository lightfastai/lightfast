/**
 * Cloud application TRPC context
 * 
 * This defines the "contexts" that are available in the backend API.
 * These allow you to access things when processing a request, like the database, the session, etc.
 * 
 * @see https://trpc.io/docs/server/context
 */

import { auth } from "@vendor/clerk/server";
import { db } from "@db/cloud/client";

/**
 * Cloud-specific context
 */
export interface CloudContext {
  headers: Headers;
  session: Awaited<ReturnType<typeof auth>>;
  db: typeof db;
}

/**
 * Creates the context for cloud TRPC procedures
 * 
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 */
export async function createCloudContext(opts: {
  headers: Headers;
}): Promise<CloudContext> {
  const session = await auth();

  // Get the source header for logging
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  if (session?.userId) {
    console.info(`>>> tRPC Request from ${source} by ${session.userId}`);
  } else {
    console.info(`>>> tRPC Request from ${source} by unknown`);
  }

  return {
    headers: opts.headers,
    session,
    db,
  };
}